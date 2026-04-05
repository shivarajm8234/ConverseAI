export declare const init: () => Promise<void>;
export declare const initiateOutboundCall: (phoneNumber: string, name: string) => Promise<string>;
export declare const handleCallTranscript: (callId: string, customerId: string, transcript: string) => Promise<void>;
export declare const forwardCall: (ctx: any, targetNumber: string) => any;
//# sourceMappingURL=index.d.ts.map