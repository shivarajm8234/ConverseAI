import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as telegram from './modules/telegram/index.js';
import * as knowledge from './modules/knowledge/index.js';
import * as calling from './modules/calling/index.js';
import * as crm from './modules/crm/index.js';
import { prisma } from './utils/db.js';
dotenv.config();
const app = express();
const port = process.env.PORT || 3001;
// Middlewares
app.use(cors());
app.use(express.json());
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});
// --- API ENDPOINTS FOR FRONTEND ---
let slots = [
    { id: '1', time: '10:00 AM', status: 'AVAILABLE' },
    { id: '2', time: '11:00 AM', status: 'BOOKED' },
    { id: '3', time: '12:00 PM', status: 'AVAILABLE' },
    { id: '4', time: '02:00 PM', status: 'AVAILABLE' }
];
app.get('/api/stats', (req, res) => {
    const bookedSlots = slots.filter(s => s.status === 'BOOKED').length;
    res.json({
        totalLeads: 124,
        activeCalls: 8,
        conversionRate: "12.5%",
        bookedSlots: 45 + bookedSlots
    });
});
app.get('/api/crm', async (req, res) => {
    const leads = await crm.getHighWeightLeads();
    res.json(leads);
});
app.get('/api/slots', (req, res) => {
    res.json(slots);
});
app.post('/api/slots', (req, res) => {
    const { time } = req.body;
    const slot = slots.find(s => s.time === time);
    if (slot && slot.status === 'AVAILABLE') {
        slot.status = 'BOOKED';
        res.json({ success: true, message: `Successfully booked for ${time}` });
    }
    else {
        res.json({ success: false, message: `Slot ${time} is unavailable or does not exist.` });
    }
});
app.get('/api/calls', async (req, res) => {
    try {
        const calls = await prisma.call.findMany({
            include: { customer: true },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json(calls.map(c => ({
            id: c.id,
            from: c.customer.phone,
            to: 'AI Agent',
            duration: `${Math.floor(c.duration / 60)}:${(c.duration % 60).toString().padStart(2, '0')}`,
            status: 'completed',
            createdAt: c.createdAt,
            summary: c.summary,
            followUpPlan: c.followUpPlan,
            transcript: c.transcript,
            direction: 'inbound'
        })));
    }
    catch (e) {
        console.error('GET /api/calls failed:', e);
        res.status(500).json({ error: 'Failed to fetch calls' });
    }
});
app.get('/api/graph', async (req, res) => {
    try {
        const [nodes, edges] = await Promise.all([
            prisma.graphNode.findMany({
                take: 100,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.graphEdge.findMany({
                take: 100,
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        res.json({ nodes, edges });
    }
    catch (e) {
        console.error('GET /api/graph failed:', e);
        res.status(500).json({ error: 'Database error' });
    }
});
app.post('/api/graph', async (req, res) => {
    try {
        const { label, content, type = 'MANUAL_ENTRY' } = req.body;
        const node = await prisma.graphNode.create({
            data: {
                label,
                type,
                metadata: { content }
            }
        });
        res.json(node);
    }
    catch (e) {
        console.error('POST /api/graph failed:', e);
        res.status(500).json({ error: 'Failed to create node' });
    }
});
app.delete('/api/graph/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.graphNode.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (e) {
        console.error('DELETE /api/graph failed:', e);
        res.status(500).json({ error: 'Failed to delete node' });
    }
});
// Admin endpoint (example)
app.post('/admin/knowledge/refresh', async (req, res) => {
    await knowledge.refreshFromStorage();
    res.json({ message: 'Refreshing from storage' });
});
app.listen(port, async () => {
    console.log(`🚀 AI Knowledge & CRM Platform Backend listening on port ${port}`);
    // Initialize Modules
    await telegram.init(app);
    await knowledge.init();
    await calling.init();
    await crm.init();
});
//# sourceMappingURL=index.js.map