import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import * as knowledge from '../knowledge/index.js';
import * as crm from '../crm/index.js';
dotenv.config();
const bot = new Telegraf(process.env.TELEGRAM_TOKEN || '');
const ADMIN_PASSWORD = "AtherAI@123";
const authenticatedUsers = new Set();
const pendingAuth = new Set();
// Admin check middleware
const isAdmin = (ctx, next) => {
    if (authenticatedUsers.has(ctx.from?.id || 0)) {
        return next();
    }
    return ctx.reply('⚠️ Unauthorized: Please authenticate with /login.');
};
export const init = async (app) => {
    if (!process.env.TELEGRAM_TOKEN) {
        console.warn('⚠️ TELEGRAM_TOKEN not provided, skipping module.');
        return;
    }
    const webhookPath = '/telegraf-webhook';
    if (process.env.WEBHOOK_URL) {
        // Production Mode: Webhook via Cloudflare Worker
        if (app) {
            app.use(bot.webhookCallback(webhookPath));
            await bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}${webhookPath}`);
        }
        console.log(`🤖 Telegram Webhook Mode: Active at ${process.env.WEBHOOK_URL}${webhookPath}`);
    }
    else {
        // Local Mode: Polling
        await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => { });
        bot.launch().catch(err => {
            if (err.response?.error_code === 409) {
                console.warn('⚠️ Telegram 409 Conflict: Polling session already active.');
            }
            else {
                console.error('Telegram launch error:', err);
            }
        });
        console.log('🤖 Telegram Polling Mode: Active (Local Debugging).');
    }
    // Graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    // Auth Commands
    bot.command('login', (ctx) => {
        pendingAuth.add(ctx.from.id);
        ctx.reply('🔐 Please enter the admin password:');
    });
    bot.command('start', (ctx) => {
        ctx.reply('👋 Welcome to AI Knowledge platform. Use /login to access admin features.');
    });
    bot.command('update', isAdmin, async (ctx) => {
        ctx.reply('📤 Please upload a file (PDF, CSV, Excel) to update the knowledge base.');
    });
    // Handle Document uploads for knowledge
    bot.on(message('document'), isAdmin, async (ctx) => {
        const document = ctx.message.document;
        const fileId = document.file_id;
        const fileName = document.file_name;
        ctx.reply(`📥 Received ${fileName}. Processing background update...`);
        // Invisibility: Process in background
        setTimeout(async () => {
            try {
                const fileUrl = await bot.telegram.getFileLink(fileId);
                await knowledge.processNewFile(fileUrl.href, fileName || 'unknown', document.mime_type || '');
                bot.telegram.sendMessage(ctx.from.id, `✅ Knowledge Base & Graph updated successfully with ${fileName}.`);
                // Notify other admins if needed
            }
            catch (error) {
                console.error('Processing error:', error);
                bot.telegram.sendMessage(ctx.from.id, `❌ Error processing ${fileName}.`);
            }
        }, 0);
    });
    // Handle Text updates for knowledge
    bot.on(message('text'), async (ctx) => {
        const text = ctx.message.text;
        // Check if user is in middle of login
        if (pendingAuth.has(ctx.from.id)) {
            if (text === ADMIN_PASSWORD) {
                authenticatedUsers.add(ctx.from.id);
                pendingAuth.delete(ctx.from.id);
                return ctx.reply('✅ Authenticated successfully! You can now send knowledge updates.');
            }
            else {
                pendingAuth.delete(ctx.from.id);
                return ctx.reply('❌ Incorrect password. Login failed.');
            }
        }
        if (text.startsWith('/'))
            return; // Ignore other commands
        // Check admin for knowledge updates
        if (!authenticatedUsers.has(ctx.from.id)) {
            return ctx.reply('⚠️ Unauthorized: Please authenticate with /login.');
        }
        ctx.reply(`📥 Received text knowledge. Processing background update...`);
        // Invisibility: Process in background
        setTimeout(async () => {
            try {
                const title = await knowledge.processNewText(text, `Update_${Date.now()}`);
                bot.telegram.sendMessage(ctx.from.id, `✅ Update Stored: "${title}"\n\nContent:\n${text}`);
            }
            catch (error) {
                console.error('Text processing error:', error);
                bot.telegram.sendMessage(ctx.from.id, `❌ Error processing text update.`);
            }
        }, 0);
    });
    bot.command('leads', isAdmin, async (ctx) => {
        const leads = await crm.getHighWeightLeads();
        const leadSummary = leads.map(l => `${l.name} (${l.phone}): Score ${l.leadScore}`).join('\n');
        ctx.reply(`📊 High Weight Customers:\n${leadSummary || 'None'}`);
    });
    console.log('🤖 Telegram Bot module initialized.');
};
export const notifyUser = async (telegramId, message) => {
    await bot.telegram.sendMessage(telegramId, message);
};
//# sourceMappingURL=index.js.map