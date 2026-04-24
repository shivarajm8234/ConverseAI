import { prisma } from '../../utils/db.js';
export const init = async () => {
    console.log('💼 CRM Module (Lead Management) initialized.');
};
// Lead Scoring Logic (simplified)
export const calculateLeadScore = (sentiment, intent, importantInfo) => {
    let score = 0.5;
    if (sentiment === 'positive' || sentiment === 'POSITIVE')
        score += 0.2;
    if (intent.toLowerCase().includes('buy') || intent.toLowerCase().includes('rent'))
        score += 0.3;
    if (importantInfo.length > 50)
        score += 0.1;
    return Math.min(1.0, score);
};
export const updateLeadFromCall = async (customerId, analysis) => {
    const newScore = calculateLeadScore(analysis.sentiment, analysis.intent, analysis.importantInfo);
    console.log(`📈 CRM Updating Customer Lead Score: ${customerId} -> ${newScore}`);
    // Prisma Update
    await prisma.customer.update({
        where: { id: customerId },
        data: {
            leadScore: newScore,
            requirements: analysis.importantInfo,
            status: analysis.requiresFollowUp ? 'WARM' : 'ACTIVE'
        }
    });
};
export const getHighWeightLeads = async () => {
    // Get all leads (or filter by score)
    try {
        return await prisma.customer.findMany({
            orderBy: { updatedAt: 'desc' },
            take: 100
        });
    }
    catch (e) {
        console.error('CRM getHighWeightLeads failed:', e);
        return [];
    }
};
export const offerRecommendations = (customerId) => {
    // LLM-driven recommendation logic
    return [
        { id: 'R1', product: 'Premium Service Rental', discount: '10%' }
    ];
};
export const onboardNewCustomer = async (data) => {
    console.log('🆕 Onboarding new customer:', data.name);
    // await prisma.customer.create({ data });
};
//# sourceMappingURL=index.js.map