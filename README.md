# VoiceAI — Real-Time AI Voice Agent for Ather Energy Showrooms

> An end-to-end AI-powered voice calling platform that answers customer queries about Ather electric scooters in **Kannada, Hindi, and English** with **sub-second latency**. The system connects real phone calls (via SIP/WebRTC through Asterisk PBX) to an AI persona named **"Shruti"**, grounded in a live Knowledge Graph of showroom data.

---

## Table of Contents

1. [How It Works — End to End](#-how-it-works--end-to-end)
2. [Architecture Diagram](#-architecture-diagram)
3. [Technology Stack](#-technology-stack)
4. [Project Structure](#-project-structure)
5. [Database Schema (Prisma)](#-database-schema-prisma)
6. [Backend API Endpoints](#-backend-api-endpoints)
7. [The AI Voice Agent (`agent_eagi.ts`)](#-the-ai-voice-agent-agent_eagits)
8. [Cloudflare Worker (Serverless API)](#-cloudflare-worker-serverless-api)
9. [Frontend Dashboard Pages](#-frontend-dashboard-pages)
10. [Telegram Bot Integration](#-telegram-bot-integration)
11. [Local Call Bridge (ADB)](#-local-call-bridge-adb)
12. [Environment Variables](#-environment-variables)
13. [Getting Started](#-getting-started)
14. [Asterisk PBX Setup & Telephony](#-asterisk-pbx-setup--telephony)
15. [Deployment Scripts](#-deployment-scripts)
16. [Troubleshooting](#-troubleshooting)
17. [Roadmap](#-roadmap)

---

## 🔁 How It Works — End to End

This is the complete lifecycle of a single phone call to the AI agent:

### Step 1 — Phone Connection
A user dials **extension 3000** from a SIP phone app (Zoiper, Sipnetic, Linphone) or from the browser-based WebRTC dialer in the dashboard. The call is routed through **Asterisk PBX**, which answers and launches the AI agent script via the AGI (Asterisk Gateway Interface) protocol.

### Step 2 — Greeting
The agent immediately **pre-fetches the Knowledge Graph** from the Supabase PostgreSQL database (all Ather showroom branches, scooter models, pricing, policies). It then generates a Kannada greeting via **Sarvam AI TTS** (`bulbul:v3` model): *"ನಮಸ್ಕಾರ! ನಾನು ಅಥರ್ ಶೋರೂಮ್‌ನಿಂದ ಶೃತಿ."*

### Step 3 — Listen & Transcribe (Loop)
Asterisk records the caller's speech into a `.wav` file (up to 10 seconds, with 2-second silence detection). The agent sends this audio to **Groq Whisper Large V3** for transcription. Groq returns the text along with the detected language (Kannada, Hindi, or English).

### Step 4 — Think & Respond
The transcript is sent to **Groq Llama 3.3-70B** (or OpenAI GPT-4o-mini as fallback) along with the pre-fetched knowledge context. The LLM generates a concise response (capped at 100 tokens / ~30 words) in the caller's language.

### Step 5 — Speak Back
The response text is converted to speech via **Sarvam TTS** (with fallbacks to HuggingFace Indic Parler TTS, Facebook MMS, or ElevenLabs). The audio is streamed back through Asterisk to the caller's phone.

### Step 6 — Repeat or Hang Up
Steps 3–5 loop until the caller hangs up or Asterisk detects a dead channel (`result=-1`).

### Step 7 — Post-Call CRM Update
After hangup, the agent:
- Sends the full transcript to the LLM to generate a **JSON summary** and **follow-up plan**.
- Looks up or creates the **Customer** record in Supabase.
- Creates a **Call** record with the transcript, summary, intent (BOOKING/QUERY), and follow-up plan.
- If the conversation mentioned "book", "appointment", or "test ride", the customer status is automatically promoted to **WARM**.

### Step 8 — Dashboard Visibility
The admin dashboard (React app) fetches the latest call history, CRM data, and knowledge graph via the backend API. All call summaries, transcripts, and follow-up plans are visible in real-time.

---

## 🏗️ Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          USER ENTRY POINTS                               │
│                                                                          │
│  📱 SIP Phone App          💻 Browser WebRTC          📲 Telegram Bot   │
│  (Zoiper/Sipnetic)         (sip.js in Dashboard)       (Admin updates)   │
│  Extension: 2000           Extension: 1001                               │
│  Pass: 5678                Pass: 1234                                    │
└──────┬────────────────────────┬───────────────────────────┬──────────────┘
       │                        │                           │
       ▼                        ▼                           ▼
┌──────────────────────────────────────────┐    ┌─────────────────────────┐
│          ASTERISK PBX (Native)           │    │  CLOUDFLARE WORKER      │
│                                          │    │  (Serverless Edge API)  │
│  pjsip.conf → SIP/WebRTC endpoints      │    │                         │
│  extensions.conf → Dial plan             │    │  • Telegram webhook     │
│                                          │    │  • Dashboard REST API   │
│  Ext 3000 → AGI(agent_eagi.js)          │    │  • Supabase REST proxy  │
│  Ext 2000 → Dial(PJSIP/2000) [mobile]  │    │                         │
│  Ext 1001 → Dial(PJSIP/1001) [webrtc]  │    └──────────┬──────────────┘
└──────────────┬───────────────────────────┘               │
               │                                           │
               ▼                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        AI PROCESSING PIPELINE                            │
│                                                                          │
│  ┌─────────────┐    ┌──────────────────┐    ┌──────────────────────┐    │
│  │ GROQ WHISPER │    │ GROQ LLAMA 3.3   │    │ SARVAM TTS           │    │
│  │ (STT)        │    │ (LLM Reasoning)  │    │ (Text-to-Speech)     │    │
│  │ whisper-     │    │ 70B-versatile    │    │ bulbul:v3            │    │
│  │ large-v3     │    │                  │    │ Speakers: shruti,    │    │
│  │              │    │ Fallback:        │    │ neha, meera          │    │
│  │ Auto-detects │    │ OpenAI GPT-4o-   │    │                      │    │
│  │ kn/hi/en     │    │ mini             │    │ Fallbacks:           │    │
│  └─────────────┘    └──────────────────┘    │ HuggingFace Parler → │    │
│                                              │ Facebook MMS →       │    │
│                                              │ ElevenLabs           │    │
│                                              └──────────────────────┘    │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      SUPABASE POSTGRESQL                                 │
│                                                                          │
│  Customer  │  Call  │  Booking  │  GraphNode  │  GraphEdge  │           │
│  DocumentChunk (pgvector)  │  KnowledgeUpdate  │  BotSession │          │
│                                                                          │
│  • CRM data (leads, scores, history)                                     │
│  • Full call transcripts + AI summaries                                  │
│  • Knowledge Graph (product specs, branch addresses, policies)           │
│  • Vector embeddings for semantic search                                 │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                REACT ADMIN DASHBOARD (Vite + Firebase Hosting)           │
│                                                                          │
│  Overview │ CRM │ Calls │ Knowledge │ Slots │ Automation │ Agent        │
│                                                                          │
│  • GSAP MagicBento animated cards with glassmorphism                     │
│  • Recharts for call volume trends                                       │
│  • Live WebRTC dialer (sip.js)                                          │
│  • Knowledge Graph CRUD management                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| Vite | 8 | Build tool & dev server |
| TypeScript | 5.9 | Type safety |
| TailwindCSS | 4 | Utility-first styling |
| GSAP | 3.14 | Premium MagicBento card animations, tilt effects, spotlight tracking |
| Recharts | 3.8 | Interactive area/bar charts for call volume & lead performance |
| sip.js | 0.21 | WebRTC SIP client (connects browser to Asterisk PBX) |
| TanStack React Query | 5.96 | Server state management with auto-refetching |
| Lucide React | 1.7 | Icon library |
| React Router | 7.13 | Client-side routing |
| Firebase | 12.11 | Hosting & Analytics |
| date-fns | 4.1 | Date formatting |
| react-day-picker | 9.14 | Calendar component for booking slots |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js + Express | 4.18 | REST API server |
| TypeScript + tsx | 5.3 / 4.21 | Language & watch-mode runner |
| Prisma | 6.19 | ORM with PostgreSQL + pgvector extension |
| OpenAI SDK | 4.20 | Unified client for both Groq and OpenAI APIs |
| Telegraf | 4.15 | Telegram bot framework |
| Twilio | 4.19 | SMS/Voice (optional) |
| pdf-parse / xlsx / csv-parser | — | Document ingestion for knowledge base |
| wavefile | 11.0 | WAV audio processing in AGI agent |
| @huggingface/inference | 3.15 | Fallback TTS via Indic Parler / Facebook MMS |
| zod | 3.22 | Schema validation |

### AI Services (External APIs)
| Service | Model | Purpose |
|---|---|---|
| **Groq** | `whisper-large-v3` | Speech-to-Text (primary) — sub-second transcription |
| **Groq** | `llama-3.3-70b-versatile` | LLM reasoning — generates responses in kn/hi/en |
| **OpenAI** | `gpt-4o-mini` | LLM fallback if no Groq key |
| **OpenAI** | `text-embedding-3-small` | Vector embeddings for semantic search |
| **Sarvam AI** | `bulbul:v3` | Text-to-Speech — native Kannada/Hindi voices (primary TTS) |
| **HuggingFace** | `ai4bharat/indic-parler-tts` | TTS fallback #1 |
| **Facebook** | `mms-tts-kan/hin/eng` | TTS fallback #2 |
| **ElevenLabs** | `eleven_multilingual_v2` | TTS fallback #3 (premium quality) |

### Voice Infrastructure
| Component | Purpose |
|---|---|
| **Asterisk PBX** | Open-source telephony server — handles SIP registration, WebRTC, and call routing |
| **PJSIP** | SIP stack used by Asterisk for endpoints (extensions 1001/2000) |
| **AGI Protocol** | Asterisk Gateway Interface — how the AI agent script communicates with Asterisk |

---

## 📁 Project Structure

```
VoiceAI-main/
├── README.md                    # This file
├── package.json                 # Root monorepo — "npm run dev" starts both backend & frontend
├── master_setup.sh              # Full end-to-end setup: installs Asterisk, builds code, deploys agent
├── deploy_agent.sh              # Quick redeploy of just the AI agent to Asterisk
├── firebase.json                # Firebase Hosting config for frontend
│
├── backend/
│   ├── .env.example             # All environment variables (see section below)
│   ├── package.json             # Backend dependencies
│   ├── tsconfig.json            # TypeScript config
│   ├── cloudflare-worker.js     # Serverless edge API (Telegram webhook + Dashboard API)
│   ├── seed_ather.js            # Seeds Knowledge Graph with Ather showroom data
│   ├── local_call_bridge.py     # Python script: polls Supabase for call triggers → dials via ADB
│   ├── configure_asterisk_webrtc.sh
│   ├── configure_sip_gateway.sh
│   ├── deploy-cloud.sh
│   │
│   ├── prisma/
│   │   └── schema.prisma        # Database models (Customer, Call, Booking, GraphNode, etc.)
│   │
│   └── src/
│       ├── index.ts             # Express server entry point — REST API for dashboard
│       ├── agent_eagi.ts        # ★ THE AI VOICE AGENT — runs inside Asterisk via AGI
│       │
│       ├── utils/
│       │   ├── ai.ts            # Groq/OpenAI client, embeddings, intent extraction, knowledge cache
│       │   └── db.ts            # Prisma client singleton
│       │
│       └── modules/
│           ├── telegram/        # Telegraf bot init & webhook handling
│           ├── knowledge/       # Document ingestion (PDF, CSV, Excel) → vector + graph storage
│           ├── calling/         # Twilio/call management logic
│           ├── crm/             # Lead scoring, customer history queries
│           └── booking/         # Slot reservation logic
│
├── frontend/
│   ├── package.json             # Frontend dependencies
│   └── src/
│       ├── App.tsx              # React Router setup — 7 pages
│       ├── main.tsx             # Entry point
│       ├── firebase.ts          # Firebase init (Analytics)
│       │
│       ├── pages/
│       │   ├── Overview.tsx     # Dashboard home — stats cards, call volume chart, lead metrics
│       │   ├── CRM.tsx          # Customer list with lead scores and statuses
│       │   ├── Calls.tsx        # WebRTC dialer + call history with transcripts & AI summaries
│       │   ├── Knowledge.tsx    # Knowledge Graph CRUD — add/delete/filter entities
│       │   ├── Slots.tsx        # Booking calendar with slot management
│       │   ├── Automation.tsx   # Chat-style Telegram automation command center
│       │   └── Agent.tsx        # System health check — backend status, stack overview
│       │
│       ├── components/
│       │   ├── layout/          # DashboardLayout, Sidebar, TopBar
│       │   └── ui/              # MagicBento (GSAP animation engine), ParticleCard
│       │
│       └── lib/                 # api.ts (base URL helper), utils.ts (cn helper)
│
├── asterisk_config/             # 107 Asterisk configuration files
│   ├── pjsip.conf              # SIP endpoints (1001 WebRTC, 2000 mobile)
│   ├── extensions.conf          # Dial plan (3000 → AI agent, 2000 → mobile, 1001 → WebRTC)
│   ├── http.conf                # HTTP server for WebSocket transport
│   ├── rtp.conf                 # RTP port range (10000–20000)
│   └── PORTSIP_SETUP.txt        # Manual SIP phone app setup guide
│
└── scripts/
    ├── asterisk_up.sh           # Quick restart if Asterisk stops
    ├── ensure_eagi_module.sh    # Checks if res_eagi.so is available
    └── fix-adb-unauthorized.sh  # Fixes ADB auth issues for call bridge
```

---

## 🗄️ Database Schema (Prisma)

The database uses **Supabase PostgreSQL** with the **pgvector** extension for vector similarity search. Here are all the models:

### `Customer`
Stores every person who has interacted with the system.
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `phone` | String (unique) | Phone number — used to match callers |
| `name` | String? | Customer name (optional) |
| `email` | String? | Email address |
| `leadScore` | Float (default: 0) | AI-calculated lead score |
| `status` | String (default: "NEW") | Lead status: NEW, WARM, HOT, COLD, CONVERTED |
| `requirements` | String? | What the customer is looking for |

### `Call`
Every voice interaction is logged here after the call ends.
| Field | Type | Description |
|---|---|---|
| `customerId` | FK → Customer | Links to the caller |
| `duration` | Int (seconds) | Call length |
| `type` | String | INBOUND or OUTBOUND |
| `transcript` | String? | Full `User: ... AI: ...` conversation log |
| `summary` | String? | LLM-generated summary of the call |
| `followUpPlan` | String? | LLM-suggested next action |
| `intent` | String? | BOOKING, QUERY, etc. — auto-classified |
| `sentiment` | String? | Positive, Neutral, Negative |

### `Booking`
Service appointment reservations.
| Field | Type | Description |
|---|---|---|
| `customerId` | FK → Customer | Who booked |
| `service` | String | What was booked (test ride, service, etc.) |
| `startTime` / `endTime` | DateTime | Time slot |
| `status` | String | BOOKED, CANCELLED, COMPLETED |

### `GraphNode`
Knowledge Graph entities — the core of the RAG system.
| Field | Type | Description |
|---|---|---|
| `label` | String | Display name (e.g., "Ather 450X") |
| `type` | String | Category: MODEL, BRANCH, POLICY, INFRA, MANUAL_ENTRY, ENTITY |
| `metadata` | JSON | Contains `{ content: "..." }` — the actual knowledge text |

### `GraphEdge`
Relationships between GraphNode entities.
| Field | Type | Description |
|---|---|---|
| `relation` | String | Relationship type (e.g., "SOLD_AT", "PART_OF") |
| `sourceNodeId` | FK → GraphNode | From entity |
| `targetNodeId` | FK → GraphNode | To entity |

### `DocumentChunk`
Vector-searchable document fragments.
| Field | Type | Description |
|---|---|---|
| `content` | String | The text content |
| `embedding` | vector(1536) | OpenAI text-embedding-3-small vector |
| `metadata` | JSON | Source information |

### `KnowledgeUpdate`
Tracks file uploads for knowledge base processing.

### `BotSession`
Tracks Telegram bot authentication sessions.

---

## 🌐 Backend API Endpoints

The Express server (`backend/src/index.ts`) runs on port **3001** and exposes:

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ status: "ok", timestamp }` |
| `GET` | `/api/stats` | Dashboard overview stats (totalLeads, activeCalls, conversionRate, bookedSlots) |
| `GET` | `/api/crm` | Returns high-weight customer leads from the CRM module |
| `GET` | `/api/calls` | Returns last 50 calls with customer info, summaries, transcripts |
| `GET` | `/api/slots` | Returns available/booked time slots |
| `POST` | `/api/slots` | Book a slot by sending `{ time: "10:00 AM" }` |
| `GET` | `/api/graph` | Returns all Knowledge Graph nodes and edges |
| `POST` | `/api/graph` | Create a new knowledge entity: `{ label, content, type? }` |
| `DELETE` | `/api/graph/:id` | Delete a knowledge entity by ID |
| `POST` | `/admin/knowledge/refresh` | Trigger re-ingestion of documents from storage |

---

## 🤖 The AI Voice Agent (`agent_eagi.ts`)

This is the heart of the system — a TypeScript script that runs inside Asterisk via the AGI protocol. It is compiled to `dist/agent_eagi.js` and deployed to `/var/lib/asterisk/agi-bin/`.

### How AGI Communication Works
```
Asterisk                          agent_eagi.js
   │                                    │
   │ ── (stdin) AGI env vars ──────────>│  (reads agi_channel, agi_callerid, etc.)
   │                                    │
   │ <── (stdout) "RECORD FILE ..." ───│  (commands sent as text)
   │                                    │
   │ ── (stdin) "200 result=0" ────────>│  (response parsed)
   │                                    │
   │ <── (stdout) "STREAM FILE ..." ───│  (plays TTS audio back)
   │                                    │
```

### AI Functions in the Agent
| Function | What it does |
|---|---|
| `prefetchKnowledge()` | Loads last 30 GraphNode entries from DB into memory at call start |
| `transcribeSTT(wavFile)` | Sends WAV to Groq Whisper, returns `{ text, lang }` |
| `askLLM(prompt, context, lang)` | Queries Groq/OpenAI with system prompt in the detected language + knowledge context |
| `generateTTS(text, lang)` | Calls Sarvam AI TTS API, writes WAV to `/tmp/tts_asterisk.wav`, streams via AGI |
| `finalizeCall(phone)` | Generates summary JSON via LLM, creates/updates Customer & Call records in Supabase |

### Multilingual System Prompts
- **Kannada**: *"ನೀವು ಅಥರ್ ಎನರ್ಜಿ ಶೋರೂಮ್‌ನ ಇವಿ ಅಸಿಸ್ಟೆಂಟ್ ಶೃತಿ. ಗ್ರಾಹಕರಿಗೆ ಸಣ್ಣ ಉತ್ತರ ನೀಡಿ."*
- **Hindi**: *"आप एथर एनर्जी शोरूम की ईवी सहायक श्रुति हैं। संक्षिप्त उत्तर दें।"*
- **English**: *"You are Shruti, an EV Assistant at Ather Energy. Keep answers very concise (under 30 words)."*

---

## ☁️ Cloudflare Worker (Serverless API)

The file `backend/cloudflare-worker.js` is an alternative serverless backend deployed on Cloudflare's edge network. It provides:

1. **Telegram Bot Webhook** (`/telegraf-webhook`) — Receives messages from Telegram, authenticates admins via `/login <password> <knowledge text>`, and stores updates directly in Supabase.
2. **Dashboard API** — Mirrors the Express API endpoints (`/api/graph`, `/api/stats`, `/api/crm`, `/api/calls`) by reading/writing directly to Supabase via its REST API.
3. **Call Trigger** (`/api/calls/trigger`) — Creates a "initiating" Call record in Supabase, which the Local Call Bridge (below) picks up to dial via ADB.

> **When to use which backend?**
> - Use the **Express server** (`npm run dev`) for local development and when Asterisk runs on the same machine.
> - Use the **Cloudflare Worker** for production when the dashboard is hosted on Firebase and doesn't have a persistent Node.js server.

---

## 📊 Frontend Dashboard Pages

All pages use the **MagicBento** animation engine (GSAP-powered spotlight tracking, tilt effects, particle borders, glassmorphism).

### 1. Overview (`/`)
- **Stat Cards**: Total Calls, Hot Leads, Warm Leads, Cold Leads — with glow-on-hover and tilt.
- **Call Volume Trends**: Recharts AreaChart showing last 7 days of call activity.
- **Lead Performance**: Progress bars for contact success, meeting booked, test drive, and final close rates.

### 2. CRM (`/crm`)
- Lists all customers from the `Customer` table.
- Shows phone number, name, lead score, status (NEW/WARM/HOT/COLD/CONVERTED).
- Data is fetched via `GET /api/crm`.

### 3. Calls (`/calls`)
- **Live Dialer Panel**: Built-in WebRTC phone using `sip.js`.
  - Register as extension **1001** (password: **1234**) against the Asterisk PBX.
  - Dial any extension: **3000** to talk to the AI agent, **2000** to call the mobile gateway.
  - Shows real-time SIP connection status (Disconnected → Connecting → Connected → In Call).
- **Mobile Gateway Config**: Shows the IP/credentials to configure a SIP phone app.
- **Call Interaction Logs**: Expandable cards for each past call showing:
  - Caller phone → AI Agent
  - Duration and status
  - **AI Summary** (auto-generated by LLM)
  - **Follow-up Plan** (auto-generated)
  - **Full Transcript** (expandable, formatted as `User: ... AI: ...`)

### 4. Knowledge (`/knowledge`)
- **Category Filters**: ALL, Branches (MapPin), Ather Models (Bike), Technology (Cpu), Warranty/Policy (ShieldCheck).
- **Entity Cards**: Each Knowledge Graph node with label, type badge, and content preview. Delete button on each.
- **Add Knowledge Form**: Create new entries with label + content.
- **Relationship Map**: Sidebar showing GraphEdge connections between entities.
- Data is fetched via `GET /api/graph` and mutations via `POST/DELETE /api/graph`.

### 5. Slots (`/slots`)
- Calendar-based booking interface using `react-day-picker`.
- Shows available time slots (10:00 AM, 11:00 AM, etc.).
- Click to book a slot → sends `POST /api/slots`.

### 6. Automation (`/automation`)
- Chat-style interface for sending Telegram automation commands.
- Quick command buttons: "Send 10% discount to all Hot Leads", "Broadcast test drive slots for Sunday", etc.
- Simulates AI processing with status feedback.

### 7. Agent (`/agent`)
- System health check page.
- Pings `GET /health` endpoint to verify API reachability.
- Shows architecture overview cards: Supabase (database), Firebase (hosting), Voice agent process, Knowledge Graph.

---

## 📲 Telegram Bot Integration

The system supports two Telegram integration modes:

### Method 1 — Direct Knowledge Update (One-liner)
Send from Telegram:
```
/login AtherAI@123 Ather 450X now available in Pearl White at Rs 1,47,000
```
This authenticates and stores the knowledge in a single message. No session needed.

### Method 2 — Session-based Authentication
1. Send `/login AtherAI@123` to authenticate.
2. After authentication, every subsequent message is stored as a knowledge update.
3. Both `DocumentChunk` (for vector search) and `GraphNode` (for knowledge graph) records are created.

### Admin Whitelisting
Set `ADMIN_TELEGRAM_ID` in `.env` to your Telegram user ID for automatic authentication without `/login`.

---

## 📱 Local Call Bridge (ADB)

`backend/local_call_bridge.py` is a Python script that bridges cloud-triggered calls to a physical Android phone connected via USB:

1. The dashboard triggers `POST /api/calls/trigger` with a phone number.
2. A Call record with status `"initiating"` is created in Supabase.
3. The Python bridge polls the `Call` table every 2 seconds.
4. When it finds an `"initiating"` call, it uses **ADB** to send a dial intent to the connected Android phone:
   ```
   adb shell am start -a android.intent.action.CALL -d tel:+919876543210
   ```
5. The call status is updated to `"connected"`.

> **Requirements**: USB Debugging enabled, ADB installed, phone connected via USB cable.

---

## 🔐 Environment Variables

Create `backend/.env` from `backend/.env.example`. Here is every variable:

### Required
| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `GROQ_API_KEY` | Groq API key — used for both Whisper STT and Llama 3.3 LLM |

### AI Configuration (Optional)
| Variable | Default | Description |
|---|---|---|
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Which Groq LLM model to use |
| `OPENAI_API_KEY` | — | Fallback LLM + embeddings (text-embedding-3-small) |
| `SARVAM_API_KEY` | — | Primary TTS provider for Indian languages |
| `HF_TOKEN` | — | HuggingFace token for Indic Parler TTS fallback |
| `ELEVENLABS_API_KEY` | — | Final TTS fallback (premium multilingual) |

### Telegram
| Variable | Description |
|---|---|
| `TELEGRAM_TOKEN` | Bot token from @BotFather |
| `ADMIN_TELEGRAM_ID` | Your Telegram user ID for auto-auth |

### Server
| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend Express server port |
| `PUBLIC_IP` | — | Public IP or ngrok URL for webhooks |

### Supabase (for Cloudflare Worker)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |

### Twilio (Optional)
| Variable | Description |
|---|---|
| `TWILIO_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 20+** and npm
- **Python 3.9+** (only for local call bridge)
- **Linux** (Ubuntu/Debian recommended for Asterisk)
- A **Supabase** project (free tier works)
- A **Groq API key** (free at [console.groq.com](https://console.groq.com))

### 1. Clone & Install
```bash
git clone https://github.com/vivekvernekar26/VoiceAI.git
cd VoiceAI

# Install root dependencies (concurrently)
npm install

# Install both frontend and backend
npm run install-all
```

### 2. Configure Environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env — at minimum set:
#   DATABASE_URL (from Supabase dashboard → Settings → Database)
#   GROQ_API_KEY (from console.groq.com)
```

### 3. Set Up Database
```bash
cd backend
npx prisma generate    # Generates the Prisma client
npx prisma db push     # Creates all tables in Supabase
node seed_ather.js     # Seeds Knowledge Graph with Ather showroom data
```

### 4. Run Development Server
```bash
# From the root directory — starts both backend and frontend
npm run dev
```
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:5173

### 5. (Optional) Set Up Asterisk for Voice Calls
```bash
# Full automated setup (installs Asterisk, builds agent, deploys everything)
sudo bash master_setup.sh
```

---

## 📞 Asterisk PBX Setup & Telephony

### How the Dial Plan Works

The file `asterisk_config/extensions.conf` defines three extensions:

```
[internal]
; AI Agent — dial 3000 from any registered phone
exten => 3000,1,Answer()
same => n,Wait(1)
same => n,AGI(/var/lib/asterisk/agi-bin/agent_eagi.js)
same => n,Hangup()

; Mobile phone gateway (SIP app like Zoiper)
exten => 2000,1,Dial(PJSIP/2000)
same => n,Hangup()

; Browser WebRTC endpoint
exten => 1001,1,Dial(PJSIP/1001)
same => n,Hangup()
```

### SIP Endpoints (pjsip.conf)

| Extension | Purpose | Username | Password | Protocol |
|---|---|---|---|---|
| **2000** | Mobile SIP App | `2000` | `5678` | UDP (port 5060) |
| **1001** | Browser WebRTC | `1001` | `1234` | WebSocket (port 8088) |

### Connecting a Mobile Phone
1. Install **Sipnetic**, **Zoiper**, or **Linphone** on your Android phone.
2. Add an account with:
   - **Server**: Your PC's LAN IP (e.g., `192.168.1.100`)
   - **Username**: `2000`
   - **Password**: `5678`
   - **Port**: `5060`
3. Dial **3000** to talk to the AI agent.

### Connecting from the Browser Dashboard
1. Go to the **Calls** page in the dashboard.
2. Enter the Asterisk server IP in the "WebRTC Desktop IP" field.
3. Click **"Connect SIP"** — the dashboard registers as extension 1001.
4. Enter **3000** in the "Extension to dial" field.
5. Click **"Dial (WebRTC)"** — you're now talking to Shruti.

---

## 🔧 Deployment Scripts

### `master_setup.sh` — Full End-to-End Setup
Runs 8 steps:
1. Removes old Docker Asterisk containers (if any).
2. Installs Asterisk, Node.js, npm, ffmpeg via apt.
3. Installs npm dependencies and builds the backend (`tsc`).
4. Generates Asterisk config files (pjsip.conf, extensions.conf, http.conf, rtp.conf).
5. Installs built agent to `/var/lib/asterisk/agi-bin/`.
6. Symlinks backend to `/opt/converse/backend` for `.env` access.
7. Enables and starts the Asterisk systemd service.
8. Reloads PJSIP and dialplan.

### `deploy_agent.sh` — Quick Agent Redeploy
Use this after editing `agent_eagi.ts`:
```bash
bash deploy_agent.sh
```
Rebuilds backend, copies the compiled `agent_eagi.js` to Asterisk's AGI directory, and reloads the dialplan.

---

## 🐛 Troubleshooting

### Agent not responding when I dial 3000
```bash
# Check if AGI script exists and is executable
ls -la /var/lib/asterisk/agi-bin/agent_eagi.js

# Check Asterisk CLI for errors
sudo asterisk -rvvv

# Check agent debug log
sudo tail -50 /tmp/agent_debug.log
```

### "GROQ_API_KEY required" error
Ensure `backend/.env` has a valid `GROQ_API_KEY`. The agent loads `.env` from three paths:
1. `/opt/converse/backend/.env`
2. `../relative/to/agent/.env`
3. `process.cwd()/.env`

### SIP registration failing
```bash
# Verify endpoint is configured
sudo asterisk -rx "pjsip show endpoint 2000"

# Check if Asterisk HTTP is running (for WebSocket)
sudo asterisk -rx "http show status"

# Restart Asterisk
sudo systemctl restart asterisk
```

### Dashboard shows "API not reachable"
Set the `VITE_API_BASE_URL` environment variable before building the frontend:
```bash
VITE_API_BASE_URL=http://localhost:3001/api npm run build
```
For Firebase-hosted dashboard with Cloudflare Worker backend, point to your Worker URL.

### Knowledge Graph empty
```bash
# Seed the database
cd backend && node seed_ather.js
```

---

## 📈 Roadmap

- [x] Sub-second STT via Groq Whisper
- [x] Multilingual AI persona (Kannada, Hindi, English)
- [x] Knowledge Graph with pre-fetching and 60s cache
- [x] CRM integration with auto lead scoring
- [x] Post-call summarization and follow-up planning
- [x] Browser-based WebRTC dialer
- [x] Telegram knowledge management
- [x] Cloudflare Worker serverless deployment
- [x] Firebase Hosting for dashboard
- [ ] Emotional sentiment analysis during live calls
- [ ] Multi-region Cloudflare Worker deployment
- [ ] Real-time STT streaming (instead of record-then-transcribe)
- [ ] Outbound campaign automation
- [ ] WhatsApp Business integration
- [ ] Voice biometrics for caller identification

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements.

---

*Built for Ather Energy showroom automation — maintained with ❤️ for next-gen voice interactions.*
