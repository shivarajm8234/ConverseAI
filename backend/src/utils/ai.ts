import OpenAI from 'openai';
import dotenv from 'dotenv';
import axios from 'axios';
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
const CACHE_TTL = 60000; // 60 seconds

/** Fetch all manual knowledge graph nodes to use as LLM context */
export const getKnowledgeContext = async () => {
  const now = Date.now();
  if (knowledgeCache && (now - knowledgeCache.ts < CACHE_TTL)) {
    return knowledgeCache.data;
  }
  
  try {
    const nodes = await prisma.graphNode.findMany({
      take: 30,
      orderBy: { createdAt: 'desc' }
    });
    const data = nodes.map(n => `${n.label}: ${n.metadata && (n.metadata as any).content ? (n.metadata as any).content : ''}`).join('\n');
    knowledgeCache = { data, ts: now };
    return data;
  } catch (e: any) {
    console.error('getKnowledgeContext Error:', e.message);
    return "Ather 450X price is Rs 1,45,000, 105km range, 90kmph top speed.";
  }
};

/** Vector-based semantic search for knowledge base */
export const searchVectorStore = async (query: string, limit = 5) => {
  try {
    const embedding = await getEmbeddings(query);
    if (!embedding) {
      return await getKnowledgeContext();
    }
    
    const vectorString = `[${embedding.join(',')}]`;
    
    // Search DocumentChunks
    const docResults = await prisma.$queryRawUnsafe(`
      SELECT content, (embedding <=> '${vectorString}'::vector) as distance
      FROM "DocumentChunk"
      ORDER BY distance ASC
      LIMIT ${limit}
    `);
    
    // Search GraphNodes
    const graphResults = await prisma.$queryRawUnsafe(`
      SELECT label, metadata, (embedding <=> '${vectorString}'::vector) as distance
      FROM "GraphNode"
      WHERE embedding IS NOT NULL
      ORDER BY distance ASC
      LIMIT ${limit}
    `);
    
    const docContext = (docResults as any[]).map(r => r.content).join('\n');
    const graphContext = (graphResults as any[]).map(r => `${r.label}: ${r.metadata?.content || ''}`).join('\n');
    
    console.log(`🔍 RAG: Found ${docResults.length} docs and ${graphResults.length} graph nodes.`);
    
    // Also include a few latest nodes for recency/general context
    const recentContext = await getKnowledgeContext();
    
    return `### RELEVANT INFORMATION:\n${docContext}\n${graphContext}\n\n### GENERAL ATHER KNOWLEDGE:\n${recentContext}`;
  } catch (e: any) {
    console.error('searchVectorStore Error:', e.message);
    return await getKnowledgeContext();
  }
};

/** Chat client: Groq when GROQ_API_KEY is set, otherwise OpenAI. */
export const openai = chatClient;
