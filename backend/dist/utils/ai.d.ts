import OpenAI from 'openai';
export declare const chatClient: OpenAI;
export declare const openai: OpenAI;
export declare const getKnowledgeContext: () => Promise<any>;
export declare const searchVectorStore: (query: string) => Promise<any>;
export declare const getEmbeddings: (text: string) => Promise<any>;
export declare const extractIntent: (text: string) => Promise<any>;
//# sourceMappingURL=ai.d.ts.map