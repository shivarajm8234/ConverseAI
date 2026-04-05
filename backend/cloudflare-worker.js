/**
 * ALL-CLOUD SERVERLESS BACKEND (Cloudflare Worker)
 * 
 * Handles:
 * 1. Telegram Bot (/telegraf-webhook)
 * 2. Dashboard API (/api/graph, /api/stats, etc.)
 * 3. Database Sync (Direct to Supabase)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    // --- TELEGRAM BOT WEBHOOK ---
    if (path === '/telegraf-webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        const msg = update.message;
        if (!msg || !msg.text) return new Response('OK', { status: 200 });

        const text = msg.text.trim();
        const chatId = msg.from.id.toString();

        // 1. One-Step Login & Add (Highly Reliable)
        if (text.startsWith(`/login ${env.ADMIN_PASSWORD}`)) {
            const content = text.replace(`/login ${env.ADMIN_PASSWORD}`, '').trim();
            if (content) {
                const title = `Update_${Date.now()}`;
                await this.storeInSupabase(content, title, env);
                await this.sendTelegramMessage(chatId, `✅ Knowledge Added!\n\nID: ${title}\nContent: ${content}`, env);
                return new Response('OK', { status: 200 });
            } else {
                await this.updateSession(chatId, true, env);
                await this.sendTelegramMessage(chatId, "✅ Authenticated! You can now send updates directly, OR just use:\n`/login password your knowledge text`", env);
                return new Response('OK', { status: 200 });
            }
        }

        // 2. Global Whitelist Check (User can manually add their ID to .env)
        const isWhitelisted = env.ADMIN_TELEGRAM_ID && (env.ADMIN_TELEGRAM_ID.includes(chatId) || env.ADMIN_TELEGRAM_ID === 'ALL');

        // 3. Fallback Session Check
        const isAuthed = isWhitelisted || (await this.checkSession(chatId, env));

        if (!isAuthed) {
            await this.sendTelegramMessage(chatId, `⚠️ Not Authorized.\n\nYour Telegram ID: ${chatId}\n\nTo update knowledge, please use:\n\`/login AtherAI@123 your knowledge content here\``, env);
            return new Response('OK', { status: 200 });
        }

        // 3. Store Data
        const title = `Update_${Date.now()}`;
        await this.storeInSupabase(text, title, env);
        await this.sendTelegramMessage(chatId, `📥 Update Stored!\n\nID: ${title}\nContent: ${text}`, env);

        return new Response('OK', { 
          status: 200, 
          headers: { 'Access-Control-Allow-Origin': '*' } 
        });
      } catch (e) {
        return this.jsonResponse({ error: e.message }, 500);
      }
    }

    // --- DASHBOARD API ---
    try {
        if ((path === '/api/graph' || path === '/graph') && request.method === 'GET') {
            const nodes = await this.fetchFromSupabase('GraphNode', env);
            const edges = await this.fetchFromSupabase('GraphEdge', env);
            return this.jsonResponse({ nodes, edges });
        }
        if ((path === '/api/graph' || path === '/graph') && request.method === 'POST') {
            const body = await request.json();
            const res = await fetch(`${env.SUPABASE_URL}/rest/v1/GraphNode`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'apikey': env.SUPABASE_KEY, 
                    'Authorization': `Bearer ${env.SUPABASE_KEY}` 
                },
                body: JSON.stringify({
                    label: body.label,
                    type: body.type || 'MANUAL_ENTRY',
                    metadata: { content: body.content }
                })
            });
            return this.jsonResponse(await res.json());
        }
        if (path.startsWith('/api/graph/') && request.method === 'DELETE') {
            const id = path.split('/').pop();
            const res = await fetch(`${env.SUPABASE_URL}/rest/v1/GraphNode?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 
                    'apikey': env.SUPABASE_KEY, 
                    'Authorization': `Bearer ${env.SUPABASE_KEY}` 
                }
            });
            return this.jsonResponse({ success: true });
        }
        if (path === '/api/stats' || path === '/stats') {
            return this.jsonResponse({ totalLeads: 124, activeCalls: 8, conversionRate: "15%", bookedSlots: 45 });
        }
        if (path === '/api/crm' || path === '/crm') {
            const leads = await this.fetchFromSupabase('Customer', env);
            return this.jsonResponse(leads);
        }
        if ((path === '/api/calls' || path === '/calls') && request.method === 'GET') {
            const history = await this.fetchFromSupabase('Call', env);
            return this.jsonResponse(history);
        }
        if ((path === '/api/calls/trigger' || path === '/calls/trigger') && request.method === 'POST') {
            const body = await request.json();
            // Record the triggered demo call in Supabase
            await fetch(`${env.SUPABASE_URL}/rest/v1/Call`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'apikey': env.SUPABASE_KEY, 
                    'Authorization': `Bearer ${env.SUPABASE_KEY}` 
                },
                body: JSON.stringify({
                    from: body.from || '7483334990',
                    to: body.to || '9620760023',
                    direction: 'outbound',
                    status: 'initiating',
                    type: 'DEMO'
                })
            });
            return this.jsonResponse({ success: true, message: "Asterisk Trigerred Call Initiated" });
        }
    } catch (e) {
        return this.jsonResponse({ error: e.message }, 500);
    }

    return new Response(`AI Dashboard Running at ${path}`, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
  },

  async updateSession(id, authed, env) {
    await fetch(`${env.SUPABASE_URL}/rest/v1/BotSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_KEY, 'Authorization': `Bearer ${env.SUPABASE_KEY}`, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ id, authed })
    });
  },

  async checkSession(id, env) {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/BotSession?id=eq.${id}&select=authed`, {
      headers: { 'apikey': env.SUPABASE_KEY, 'Authorization': `Bearer ${env.SUPABASE_KEY}` }
    });
    const data = await res.json();
    return data && data[0] && data[0].authed;
  },

  async sendTelegramMessage(chatId, text, env) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text })
    });
  },

  async storeInSupabase(text, title, env) {
    const headers = { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_KEY, 'Authorization': `Bearer ${env.SUPABASE_KEY}` };
    await fetch(`${env.SUPABASE_URL}/rest/v1/DocumentChunk`, { method: 'POST', headers, body: JSON.stringify({ content: text, metadata: { source: 'CloudWorker', type: 'text' } }) });
    await fetch(`${env.SUPABASE_URL}/rest/v1/GraphNode`, { method: 'POST', headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' }, body: JSON.stringify({ id: title, label: title, type: 'MANUAL_ENTRY', metadata: { content: text } }) });
  },

  async fetchFromSupabase(table, env) {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?select=*`, { headers: { 'apikey': env.SUPABASE_KEY, 'Authorization': `Bearer ${env.SUPABASE_KEY}` } });
    return res.json();
  },

  jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), { 
      status, 
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
      } 
    });
  }
};
