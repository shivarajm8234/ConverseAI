export declare const init: () => Promise<void>;
export declare const calculateLeadScore: (sentiment: string, intent: string, importantInfo: string) => number;
export declare const updateLeadFromCall: (customerId: string, analysis: any) => Promise<void>;
export declare const getHighWeightLeads: () => Promise<{
    id: string;
    name: string;
    phone: string;
    leadScore: number;
    status: string;
}[]>;
export declare const offerRecommendations: (customerId: string) => {
    id: string;
    product: string;
    discount: string;
}[];
export declare const onboardNewCustomer: (data: any) => Promise<void>;
//# sourceMappingURL=index.d.ts.map