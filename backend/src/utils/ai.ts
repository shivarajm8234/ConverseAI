import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const getEmbeddings = async (text: string) => {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
};

export const processDocument = async (content: string) => {
  // Extract entities for Knowledge Graph
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Extract entities and their relationships from the following text in JSON format: { entities: [{ name, type, properties }], relationships: [{ source, target, relationship }] }',
      },
      {
        role: 'user',
        content,
      },
    ],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(completion.choices[0].message.content || '{}');
};

export const extractIntent = async (transcript: string) => {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Exract intent, customer sentiment, and important information from this call transcript in JSON: { intent, sentiment, importantInfo, requiresFollowUp }',
        },
        {
          role: 'user',
          content: transcript,
        },
      ],
      response_format: { type: 'json_object' },
    });
  
    return JSON.parse(completion.choices[0].message.content || '{}');
};
export { openai };
