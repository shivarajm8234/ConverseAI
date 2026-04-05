import axios from 'axios';
import pdf from 'pdf-parse';
import * as ai from '../../utils/ai.js';
import { prisma } from '../../utils/db.js';
import fs from 'fs-extra';

export const init = async () => {
  console.log('📚 Knowledge Base initialized.');
};

const updateGraphFromContent = async (text: string, title: string) => {
  // Simple direct node creation without AI
  await prisma.graphNode.upsert({
      where: { id: title },
      update: { metadata: { content: text, lastUpdated: new Date() } as any },
      create: { 
          id: title,
          label: title,
          type: 'MANUAL_ENTRY',
          metadata: { content: text } as any
      }
  }).catch((err: any) => console.warn(`Graph node upsert error: ${err.message}`));
};

export const processNewFile = async (fileUrl: string, fileName: string, mimeType: string) => {
  const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);
  let content = buffer.toString('utf-8'); 
  
  // Vector index (zero-vector placeholder formatted as string)
  const zeroVectorStr = `[${new Array(1536).fill(0).join(',')}]`;
  await prisma.$executeRaw`
      INSERT INTO "DocumentChunk" (id, content, embedding, metadata, "createdAt")
      VALUES (gen_random_uuid(), ${content}, ${zeroVectorStr}::vector, ${JSON.stringify({ fileName, mimeType })}::jsonb, NOW())
    `;

  await updateGraphFromContent(content, fileName);
  
  await prisma.knowledgeUpdate.create({
    data: { filename: fileName, fileType: mimeType, version: 1, status: 'PROCESSED' }
  });
};

export const processNewText = async (text: string, sourceName: string) => {
  const zeroVectorStr = `[${new Array(1536).fill(0).join(',')}]`;
  await prisma.$executeRaw`
      INSERT INTO "DocumentChunk" (id, content, embedding, metadata, "createdAt")
      VALUES (gen_random_uuid(), ${text}, ${zeroVectorStr}::vector, ${JSON.stringify({ source: sourceName, type: 'text' })}::jsonb, NOW())
    `;

  await updateGraphFromContent(text, sourceName);
  return sourceName;
};

export const refreshFromStorage = async () => {
  // Re-index all processed files if needed
  console.log('🔄 Re-indexing from storage...');
};
