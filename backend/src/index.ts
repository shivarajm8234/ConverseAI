import express from 'express';
import dotenv from 'dotenv';
import * as telegram from './modules/telegram';
import * as knowledge from './modules/knowledge';
import * as calling from './modules/calling';
import * as crm from './modules/crm';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Admin endpoint (example)
app.post('/admin/knowledge/refresh', async (req, res) => {
  await knowledge.refreshFromStorage();
  res.json({ message: 'Refreshing from storage' });
});

app.listen(port, async () => {
  console.log(`🚀 AI Knowledge & CRM Platform Backend listening on port ${port}`);
  
  // Initialize Modules
  await telegram.init();
  await knowledge.init();
  await calling.init();
  await crm.init();
});
