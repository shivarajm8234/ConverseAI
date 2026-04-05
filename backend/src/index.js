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
app.get('/api/calls', (req, res) => {
    // Mock Call Logs
    res.json([
        { id: 'C1', contact: 'John Doe', duration: '5:24', status: 'COMPLETED', sentiment: 'POSITIVE' },
        { id: 'C2', contact: 'Alice Smith', duration: '2:10', status: 'MISSED', sentiment: 'NEUTRAL' }
    ]);
});
app.get('/api/graph', async (req, res) => {
    // Get graph nodes and edges from Supabase
    const nodes = await prisma.graphNode.findMany({
        take: 100,
        include: { sources: true, targets: true }
    });
    const edges = await prisma.graphEdge.findMany({
        take: 100
    });
    res.json({ nodes, edges });
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