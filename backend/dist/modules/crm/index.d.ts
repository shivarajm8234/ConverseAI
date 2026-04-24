export declare const init: () => Promise<void>;
export declare const calculateLeadScore: (sentiment: string, intent: string, importantInfo: string) => number;
export declare const updateLeadFromCall: (customerId: string, analysis: any) => Promise<void>;
export declare const getHighWeightLeads: () => Promise<{
    name: string | null;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    phone: string;
    email: string | null;
    leadScore: number;
    status: string;
    requirements: string | null;
}[]>;
export declare const offerRecommendations: (customerId: string) => {
    id: string;
    product: string;
    discount: string;
}[];
export declare const onboardNewCustomer: (data: any) => Promise<void>;
//# sourceMappingURL=index.d.ts.map