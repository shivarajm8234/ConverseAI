import OpenAI from 'openai';
export declare const getEmbeddings: (text: string) => Promise<number[] | undefined>;
export declare const processDocument: (content: string) => Promise<any>;
export declare const extractIntent: (transcript: string) => Promise<any>;
/** Fetch all manual knowledge graph nodes to use as LLM context */
export declare const getKnowledgeContext: () => Promise<string>;
/** Chat client: Groq when GROQ_API_KEY is set, otherwise OpenAI. */
export declare const openai: OpenAI;
//# sourceMappingURL=ai.d.ts.map