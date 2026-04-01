import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import * as knowledge from '../knowledge';
import * as crm from '../crm';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN || '');

// Admin check middleware
const isAdmin = (ctx: Context, next: () => Promise<void>) => {
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (ctx.from?.id.toString() === adminId) {
    return next();
  }
  return ctx.reply('⚠️ Unauthorized: Admin only.');
};

export const init = async () => {
  if (!process.env.TELEGRAM_TOKEN) {
    console.warn('⚠️ TELEGRAM_TOKEN not provided, skipping module.');
    return;
  }

  // Admin Commands
  bot.command('start', (ctx) => {
    ctx.reply('👋 Welcome to AI Call & Knowledge platform. Admin, use /update to refresh system.');
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
        } catch (error) {
            console.error('Processing error:', error);
            bot.telegram.sendMessage(ctx.from.id, `❌ Error processing ${fileName}.`);
        }
    }, 0);
  });

  bot.command('leads', isAdmin, async (ctx) => {
     const leads = await crm.getHighWeightLeads();
     const leadSummary = leads.map(l => `${l.name} (${l.phone}): Score ${l.leadScore}`).join('\n');
     ctx.reply(`📊 High Weight Customers:\n${leadSummary || 'None'}`);
  });

  bot.launch();
  console.log('🤖 Telegram Bot launched.');
};

export const notifyUser = async (telegramId: string, message: string) => {
    await bot.telegram.sendMessage(telegramId, message);
};
