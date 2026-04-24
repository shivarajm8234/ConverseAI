import OpenAI from 'openai';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { prisma } from './db.js';
import { pipeline } from '@xenova/transformers';

dotenv.config();

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1' as const;
const SARVAM_BASE_URL = 'https://api.sarvam.ai' as const;

const groqKey = process.env.GROQ_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const sarvamKey = process.env.SARVAM_API_KEY;

const useSarvam = Boolean(sarvamKey?.length);
const useGroq = !useSarvam && Boolean(groqKey?.length);

const groqModel = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
const sarvamModel = 'gajendra:v1';

function assertChatConfigured(): void {
  if (!useGroq && !openaiKey?.length) {
    throw new Error(
      'Set GROQ_API_KEY (recommended) or OPENAI_API_KEY for LLM features.',
    );
  }
}

const chatClient = new OpenAI({
  apiKey: useSarvam ? sarvamKey! : (useGroq ? groqKey! : openaiKey!),
  baseURL: useSarvam ? SARVAM_BASE_URL : (useGroq ? GROQ_BASE_URL : undefined),
  defaultHeaders: useSarvam ? { 'api-subscription-key': sarvamKey! } : undefined
});

const embeddingClient =
  openaiKey !== undefined && openaiKey.length > 0
    ? new OpenAI({ apiKey: openaiKey })
    : null;

const chatModel = useSarvam ? sarvamModel : (useGroq ? groqModel : 'gpt-4o-mini');

let embedder: any = null;

export const getEmbeddings = async (text: string) => {
  try {
    if (!embedder) {
      console.log('🌀 Loading local multilingual model (paraphrase-multilingual-MiniLM-L12-v2)...');
      embedder = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
    }
    
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data) as number[];
  } catch (e: any) {
    console.error('getEmbeddings Error:', e.message);
    return undefined;
  }
};

export const processDocument = async (content: string) => {
  assertChatConfigured();
  const completion = await chatClient.chat.completions.create({
    model: chatModel,
    messages: [
      {
        role: 'system',
        content:
          'Extract entities and their relationships from the following text in JSON format: { entities: [{ name, type, properties }], relationships: [{ source, target, relationship }] }',
      },
      {
        role: 'user',
        content,
      },
    ],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(completion.choices?.[0]?.message?.content ?? '{}');
};

export const extractIntent = async (transcript: string) => {
  assertChatConfigured();
  const completion = await chatClient.chat.completions.create({
    model: chatModel,
    messages: [
      {
        role: 'system',
        content:
          'Exract intent, customer sentiment, and important information from this call transcript in JSON: { intent, sentiment, importantInfo, requiresFollowUp }',
      },
      {
        role: 'user',
        content: transcript,
      },
    ],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(completion.choices?.[0]?.message?.content ?? '{}');
};

let knowledgeCache: { data: string, ts: number } | null = null;

// Local Fallback Brain State
let localKnowledgeVectors: { label: string, type: string, content: string, embedding: number[] }[] = [];

/** Pre-vectorize the local fallback JSON for instant RAG if DB is down */
const initLocalBrain = async () => {
  try {
    const fallbackPath = path.join(process.cwd(), 'src/utils/knowledge_fallback.json');
    if (!fs.existsSync(fallbackPath)) return;
    
    const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    console.log('🧠 Pre-vectorizing Local Brain...');
    
    for (const node of fallbackData.nodes) {
      const fullText = `${node.label}: ${node.content}`;
      const embedding = await getEmbeddings(fullText);
      if (embedding) {
        localKnowledgeVectors.push({ ...node, embedding });
      }
    }
    console.log(`✅ Local Brain ready with ${localKnowledgeVectors.length} vectorized nodes.`);
  } catch (err) {
    console.error('❌ Failed to init Local Brain:', err);
  }
};

// Start local brain init
initLocalBrain();

/** Fetch all manual knowledge graph nodes to use as LLM context */
export const getKnowledgeContext = async () => {
  try {
    const nodes = await prisma.graphNode.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
    
    if (nodes.length === 0) throw new Error('No nodes found');
    
    return nodes
      .map((n) => `${n.label}: ${(n.metadata as any)?.content || ''}`)
      .join('\n');
  } catch (e: any) {
    console.warn('getKnowledgeContext Prisma Error, trying REST fallback...', e.message);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        const res = await axios.get(`${supabaseUrl}/rest/v1/GraphNode?select=label,metadata&limit=20&order=createdAt.desc`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        if (res.data.length > 0) {
            return res.data
              .map((n: any) => `${n.label}: ${n.metadata?.content || ''}`)
              .join('\n');
        }
      }
      throw new Error('Supabase empty/missing');
    } catch (restErr: any) {
      console.error('getKnowledgeContext Fallback to Local Brain:', restErr.message);
      return localKnowledgeVectors
        .map((n: any) => `${n.label}: ${n.content}`)
        .join('\n');
    }
  }
};

/** Helper for cosine similarity */
function cosineSimilarity(a: number[], b: number[]) {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for(let i = 0; i < a.length; i++){
      dotProduct += (a[i] * b[i]);
      mA += (a[i] * a[i]);
      mB += (b[i] * b[i]);
  }
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
}

/** Vector-based semantic search for knowledge base */
export const searchVectorStore = async (query: string, limit = 5) => {
  try {
    const embedding = await getEmbeddings(query);
    if (!embedding) return await getKnowledgeContext();

    const vectorString = `[${embedding.join(',')}]`;
    
    // 1. Try Prisma first
    let docContext = "";
    let graphContext = "";

    try {
        const docChunks: any = await prisma.$queryRawUnsafe(`
          SELECT content, metadata, 1 - (embedding <=> '${vectorString}'::vector) as similarity
          FROM "DocumentChunk"
          ORDER BY similarity DESC
          LIMIT $1
        `, limit);

        const graphNodes: any = await prisma.$queryRawUnsafe(`
          SELECT label, type, metadata, 1 - (embedding <=> '${vectorString}'::vector) as similarity
          FROM "GraphNode"
          ORDER BY similarity DESC
          LIMIT $1
        `, limit);

        docContext = docChunks.map((c: any) => c.content).join('\n');
        graphContext = graphNodes.map((n: any) => `${n.label} (${n.type}): ${n.metadata?.content || ''}`).join('\n');
    } catch (dbErr) {
        console.warn('⚠️ Vector DB unreachable, using In-Memory Semantic Search...');
        
        // 2. Fallback to Local In-Memory Vector Search
        const localResults = localKnowledgeVectors
            .map(node => ({
                ...node,
                similarity: cosineSimilarity(embedding, node.embedding)
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
        
        graphContext = localResults.map(n => `${n.label} (${n.type}): ${n.content}`).join('\n');
    }

    return `### RELEVANT INFORMATION:\n${docContext}\n${graphContext}`;
  } catch (e: any) {
    console.error('searchVectorStore Error:', e.message);
    return await getKnowledgeContext();
  }
};

/** Chat client: Groq when GROQ_API_KEY is set, otherwise OpenAI. */
export const openai = chatClient;
