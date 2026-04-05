import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const groqKey = process.env.GROQ_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const useGroq = Boolean(groqKey?.length);
const groqModel = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
function assertChatConfigured() {
    if (!useGroq && !openaiKey?.length) {
        throw new Error('Set GROQ_API_KEY (recommended) or OPENAI_API_KEY for LLM features.');
    }
}
const chatClient = new OpenAI({
    apiKey: useGroq ? groqKey : openaiKey,
    baseURL: useGroq ? GROQ_BASE_URL : undefined,
});
const embeddingClient = openaiKey !== undefined && openaiKey.length > 0
    ? new OpenAI({ apiKey: openaiKey })
    : null;
const chatModel = useGroq ? groqModel : 'gpt-4o-mini';
export const getEmbeddings = async (text) => {
    if (!embeddingClient) {
        console.warn('getEmbeddings: No OPENAI_API_KEY (Groq does not expose OpenAI-style embeddings). Skipping.');
        return undefined;
    }
    const response = await embeddingClient.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
    });
    return response.data?.[0]?.embedding;
};
export const processDocument = async (content) => {
    assertChatConfigured();
    const completion = await chatClient.chat.completions.create({
        model: chatModel,
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
    return JSON.parse(completion.choices?.[0]?.message?.content ?? '{}');
};
export const extractIntent = async (transcript) => {
    assertChatConfigured();
    const completion = await chatClient.chat.completions.create({
        model: chatModel,
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
    return JSON.parse(completion.choices?.[0]?.message?.content ?? '{}');
};
/** Chat client: Groq when GROQ_API_KEY is set, otherwise OpenAI. */
export const openai = chatClient;
//# sourceMappingURL=ai.js.map