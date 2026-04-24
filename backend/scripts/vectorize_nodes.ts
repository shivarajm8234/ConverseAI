import { PrismaClient } from '@prisma/client';
import { getEmbeddings } from '../src/utils/ai.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function vectorizeNodes() {
  console.log('🔍 Fetching all graph nodes...');
  
  let nodes: any[] = [];
  try {
    nodes = await prisma.graphNode.findMany();
  } catch (e) {
    console.warn('⚠️ Prisma fetch failed, trying REST fallback...');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
        const res = await axios.get(`${supabaseUrl}/rest/v1/GraphNode?select=*`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        nodes = res.data;
    }
  }

  console.log(`Found ${nodes.length} nodes.`);

  for (const node of nodes) {
    console.log(`🌀 Vectorizing node: "${node.label}"...`);
    const fullContent = `${node.label}: ${node.metadata?.content || ''}`;
    const embedding = await getEmbeddings(fullContent);

    if (embedding) {
      const vectorString = `[${embedding.join(',')}]`;
      try {
        await prisma.$executeRawUnsafe(`
          UPDATE "GraphNode"
          SET embedding = '${vectorString}'::vector
          WHERE id = $1
        `, node.id);
        console.log(`✅ Success (Prisma) for "${node.label}"`);
      } catch (e: any) {
        console.warn(`⚠️ Prisma update failed for "${node.label}", trying REST fallback...`);
        try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            if (supabaseUrl && supabaseKey) {
                await axios.patch(`${supabaseUrl}/rest/v1/GraphNode?id=eq.${node.id}`, 
                { embedding: vectorString },
                {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }
                });
                console.log(`✅ Success (REST) for "${node.label}"`);
            }
        } catch (err: any) {
            console.error(`❌ All update methods failed for "${node.label}": ${err.message}`);
        }
      }
    } else {
      console.log(`❌ Failed to get embedding for "${node.label}"`);
    }
  }

  console.log('✨ All nodes processed.');
}

vectorizeNodes()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
