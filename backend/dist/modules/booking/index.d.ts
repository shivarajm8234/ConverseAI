export declare const init: () => Promise<void>;
export declare const getAvailableSlots: (serviceName: string) => Promise<{
    startTime: string;
    endTime: string;
    status: string;
}[]>;
export declare const reserveSlot: (customerId: string, serviceName: string, startTime: string) => Promise<{
    success: boolean;
    bookingId: string;
}>;
export declare const updateAvailability: () => Promise<void>;
//# sourceMappingURL=index.d.ts.map