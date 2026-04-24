import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import * as telegram from './modules/telegram/index.js';
import * as knowledge from './modules/knowledge/index.js';
import * as calling from './modules/calling/index.js';
import * as crm from './modules/crm/index.js';
import { prisma } from './utils/db.js';
import { getEmbeddings } from './utils/ai.js';

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

// Config endpoint for IP discovery
app.get('/api/config', (req, res) => {
    let localIp = 'localhost';
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]!) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
                break;
            }
        }
        if (localIp !== 'localhost') break;
    }

    res.json({
        publicIp: process.env.PUBLIC_IP || localIp,
        localIp: localIp,
        port: port
    });
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
    } else {
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
    } catch (e) {
        console.warn('⚠️ GET /api/calls failed (Database unreachable):', e);
        res.json([]); // Return empty array to keep frontend happy
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
    } catch (e) {
        console.warn('⚠️ GET /api/graph failed (Prisma error), trying Supabase REST fallback...', e);
        try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            
            if (supabaseUrl && supabaseKey) {
                const [nodesRes, edgesRes] = await Promise.all([
                    axios.get(`${supabaseUrl}/rest/v1/GraphNode?select=*&limit=100`, {
                        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                    }),
                    axios.get(`${supabaseUrl}/rest/v1/GraphEdge?select=*&limit=100`, {
                        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                    })
                ]);
                return res.json({ nodes: nodesRes.data, edges: edgesRes.data });
            }
            throw new Error('Supabase keys missing');
        } catch (fallbackErr: any) {
            console.error('❌ Fallback fetch failed:', fallbackErr.message);
            // Fallback to local JSON if even REST fails
            const fallbackPath = path.join(process.cwd(), 'src/utils/knowledge_fallback.json');
            const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
            const nodes = fallbackData.nodes.map((n: any) => ({
                id: n.label,
                label: n.label,
                type: n.type,
                metadata: { content: n.content },
                createdAt: new Date()
            }));
            res.json({ nodes, edges: [] });
        }
    }
});

app.post('/api/graph', async (req, res) => {
    try {
        const { label, content, type = 'MANUAL_ENTRY' } = req.body;
        
        // 1. Generate embedding for the node
        const fullContent = `${label}: ${content}`;
        const embedding = await getEmbeddings(fullContent);
        
        // 2. Create the Graph Node with embedding
        let node;
        if (embedding) {
            const vectorString = `[${embedding.join(',')}]`;
            node = await prisma.$queryRawUnsafe(`
                INSERT INTO "GraphNode" (id, label, type, metadata, embedding, "createdAt")
                VALUES (gen_random_uuid(), $1, $2, $3, '${vectorString}'::vector, now())
                RETURNING *
            `, label, type, { content });
            console.log(`✅ Vectorized graph node created: ${label}`);
            res.json((node as any)[0]);
        } else {
            node = await prisma.graphNode.create({
                data: {
                    label,
                    type,
                    metadata: { content }
                }
            });
            res.json(node);
        }
    } catch (e) {
        console.warn('⚠️ POST /api/graph failed (Prisma), trying REST fallback...', e);
        try {
            const { label, content, type = 'MANUAL_ENTRY' } = req.body;
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            
            if (supabaseUrl && supabaseKey) {
                // Generate embedding first
                const fullContent = `${label}: ${content}`;
                const embedding = await getEmbeddings(fullContent);
                const vectorString = embedding ? `[${embedding.join(',')}]` : null;

                const resNode = await axios.post(`${supabaseUrl}/rest/v1/GraphNode`, {
                    label,
                    type,
                    metadata: { content },
                    embedding: vectorString
                }, {
                    headers: { 
                        'apikey': supabaseKey, 
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    }
                });
                return res.json(resNode.data[0]);
            }
            throw new Error('Supabase keys missing');
        } catch (fallbackErr: any) {
            console.error('❌ Fallback creation failed:', fallbackErr.message);
            res.status(500).json({ error: 'Failed to create node even with fallback' });
        }
    }
});

app.delete('/api/graph/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.graphNode.delete({ where: { id } });
        res.json({ success: true });
    } catch (e) {
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
