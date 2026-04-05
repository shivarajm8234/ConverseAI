#!/bin/bash

# --- CLOUD DEPLOYMENT SCRIPT ---
# This script deploys your serverless backend to Cloudflare
# and configures the Telegram Bot to point to it.

echo "🚀 Starting 100% Cloud Deployment..."

# 1. Extract Keys from .env
echo "🗝️  Extracting keys from .env..."
TG_TOKEN=$(grep '^TELEGRAM_TOKEN=' .env | cut -d'=' -f2)
S_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env | cut -d'=' -f2)
S_KEY=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env | cut -d'=' -f2)
ADMIN_PASS="AtherAI@123"

# 2. Deploy the Worker
echo "📦 Deploying Cloudflare Worker..."
npx wrangler deploy cloudflare-worker.js --name converseai --compatibility-date 2024-04-01

# 3. Configure Secrets (Automatic)
echo "🔐 Setting Secret Variables in Cloudflare..."

echo "$TG_TOKEN" | npx wrangler secret put TELEGRAM_TOKEN --name converseai
echo "$S_URL" | npx wrangler secret put SUPABASE_URL --name converseai
echo "$S_KEY" | npx wrangler secret put SUPABASE_KEY --name converseai
echo "$ADMIN_PASS" | npx wrangler secret put ADMIN_PASSWORD --name converseai

# 4. Register the Telegram Webhook
echo "🤖 Registering Webhook with Telegram..."
WORKER_URL="https://converseai.shivarajmani2005.workers.dev/telegraf-webhook"

curl -X POST "https://api.telegram.org/bot$TG_TOKEN/setWebhook?url=$WORKER_URL&drop_pending_updates=true"

echo "✅ Deployment finished! Your AI platform is now 24/7 in the cloud."
echo "🔗 Frontend: https://converseaii.web.app"
echo "🔗 Bot: t.me/athervoicebot"
