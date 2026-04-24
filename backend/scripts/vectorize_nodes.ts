import { prisma } from '../src/utils/db.js';
import { getEmbeddings } from '../src/utils/ai.js';
import dotenv from 'dotenv';

dotenv.config();

async function vectorizeExistingNodes() {
    console.log('🔍 Fetching all graph nodes...');
    const nodes = await prisma.graphNode.findMany();
    console.log(`Found ${nodes.length} nodes.`);

    for (const node of nodes) {
        const content = (node.metadata as any)?.content || '';
        const fullContent = `${node.label}: ${content}`;
        
        console.log(`🌀 Vectorizing node via Sarvam: "${node.label}"...`);
        const embedding = await getEmbeddings(fullContent);
        
        if (embedding) {
            const vectorString = `[${embedding.join(',')}]`;
            await prisma.$executeRawUnsafe(`
                UPDATE "GraphNode" 
                SET embedding = '${vectorString}'::vector
                WHERE id = $1
            `, node.id);
            console.log(`✅ Success.`);
        } else {
            console.log(`❌ Failed to get embedding for "${node.label}"`);
        }
    }

    console.log('✨ All nodes processed.');
    process.exit(0);
}

vectorizeExistingNodes().catch(e => {
    console.error(e);
    process.exit(1);
});
