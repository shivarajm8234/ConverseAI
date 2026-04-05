# VoiceAI Backend Engine (TypeScript + Node.js)

The core orchestration engine for the VoiceAI platform, responsible for real-time speech processing, knowledge retrieval (RAG), CRM synchronization, and call management.

---

## 🔥 Key Mechanics

### 1. Sub-second Latency Pipeline
- **Orchestration**: Node.js + Prisma for extremely fast data access and session management.
- **STT Engine**: Integrated with **Groq Whisper-v3** for low-latency transcription.
- **LLM Reasoning**: Utilizes **Groq Llama 3.3-70B** for high-speed response generation with technical grounding.

### 2. Hybrid RAG (Retrieval-Augmented Generation)
- **Vector DB**: PostgreSQL with `pgvector` for semantic document chunking (OpenAI `text-embedding-3-small`).
- **Knowledge Graph**: Custom graph implementation (Nodes/Edges) using Prisma for structured factual grounding (e.g., product specs, showroom details).
- **Auto-Extraction**: Automatic entity and relationship extraction from uploaded documents.

### 3. Voice Infrastructure (Asterisk Bridge)
- **SIP Bridge**: Connects to the Asterisk PBX for handling real-time audio streams.
- **Transcript Analysis**: Automatic intent extraction, sentiment analysis, and follow-up planning after every call.

---

## 🚀 Getting Started

### 1. Installation
```bash
npm install
```

### 2. Database Initialization
```bash
# Generate Prisma client
npx prisma generate

# Apply schema to database
npx prisma db push

# (Optional) Seed the database with sample showroom data
node seed_ather.js
```

### 3. Environment Variables (`.env`)
Ensure you have the following configured:
- `GROQ_API_KEY`: For LLM and STT.
- `OPENAI_API_KEY`: For Embeddings.
- `DATABASE_URL`: Your PostgreSQL connection string.
- `ADMIN_TELEGRAM_ID`: To authorize management via Telegram.

### 4. Running the Engine
```bash
npm run dev
```

---

## 📂 Internal Modules

- `src/utils/ai.ts`: Central AI routing for embeddings, intent extraction, and knowledge context.
- `src/modules/knowledge`: Logic for processing and indexing documents into the Hybrid RAG.
- `src/modules/calling`: Real-time call handling and Asterisk signaling bridge.
- `src/modules/crm`: Customer lifecycle management and lead scoring updates.
- `prisma/`: Database schema definitions and migrations.

---
*Optimized for extreme responsiveness and intelligent grounding.*

