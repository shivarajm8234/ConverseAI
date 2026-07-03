import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();
const SARVAM_BASE_URL = 'https://api.sarvam.ai';
const sarvamKey = process.env.SARVAM_API_KEY;
export const chatClient = new OpenAI({
    apiKey: sarvamKey,
    baseURL: SARVAM_BASE_URL,
    defaultHeaders: { 'api-subscription-key': sarvamKey }
});
export const openai = chatClient;
export const getKnowledgeContext = async () => "";
export const searchVectorStore = async (query) => "";
export const getEmbeddings = async (text) => [0, 0, 0];
export const extractIntent = async (text) => ({ intent: "QUERY", sentiment: "NEUTRAL" });
//# sourceMappingURL=ai.js.map