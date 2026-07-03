import axios from 'axios';
import pdf from 'pdf-parse';
import * as ai from '../../utils/ai.js';
import { prisma } from '../../utils/db.js';
import fs from 'fs-extra';
export const init = async () => {
    console.log('📚 Knowledge Base initialized.');
};
const updateGraphFromContent = async (text, title) => {
    // Simple direct node creation without AI
    await prisma.graphNode.upsert({
        where: { id: title },
        update: { metadata: { content: text, lastUpdated: new Date() } },
        create: {
            id: title,
            label: title,
            type: 'MANUAL_ENTRY',
            metadata: { content: text }
        }
    }).catch((err) => console.warn(`Graph node upsert error: ${err.message}`));
};
export const processNewFile = async (fileUrl, fileName, mimeType) => {
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    let content = buffer.toString('utf-8');
    // Real Vector Indexing
    const embedding = await ai.getEmbeddings(content);
    if (embedding) {
        const vectorStr = `[${embedding.join(',')}]`;
        await prisma.$executeRawUnsafe(`
        INSERT INTO "DocumentChunk" (id, content, embedding, metadata, "createdAt")
        VALUES (gen_random_uuid(), $1, '${vectorStr}'::vector, $2, NOW())
      `, content, JSON.stringify({ fileName, mimeType }));
    }
    await updateGraphFromContent(content, fileName);
    await prisma.knowledgeUpdate.create({
        data: { filename: fileName, fileType: mimeType, version: 1, status: 'PROCESSED' }
    });
};
export const processNewText = async (text, sourceName) => {
    // Real Vector Indexing
    const embedding = await ai.getEmbeddings(text);
    if (embedding) {
        const vectorStr = `[${embedding.join(',')}]`;
        await prisma.$executeRawUnsafe(`
        INSERT INTO "DocumentChunk" (id, content, embedding, metadata, "createdAt")
        VALUES (gen_random_uuid(), $1, '${vectorStr}'::vector, $2, NOW())
      `, text, JSON.stringify({ source: sourceName, type: 'text' }));
    }
    await updateGraphFromContent(text, sourceName);
    return sourceName;
};
export const refreshFromStorage = async () => {
    // Re-index all processed files if needed
    console.log('🔄 Re-indexing from storage...');
};
//# sourceMappingURL=index.js.map