import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const SARVAM_BASE_URL = 'https://api.sarvam.ai' as const;
const sarvamKey = process.env.SARVAM_API_KEY;

export const chatClient = new OpenAI({
  apiKey: sarvamKey,
  baseURL: SARVAM_BASE_URL,
  defaultHeaders: { 'api-subscription-key': sarvamKey! }
});

export const openai = chatClient;

export const getKnowledgeContext = async (): Promise<any> => "";
export const searchVectorStore = async (query: string): Promise<any> => "";
export const getEmbeddings = async (text: string): Promise<any> => [0,0,0];
export const extractIntent = async (text: string): Promise<any> => ({ intent: "QUERY", sentiment: "NEUTRAL" });
