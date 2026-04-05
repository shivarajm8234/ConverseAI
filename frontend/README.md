# VoiceAI Frontend - Premium Admin Dashboard

A professional, high-performance admin dashboard for VoiceAI agents, featuring sub-second telemetry and a premium interactive design. Built with React 19, TypeScript, and Vite.

---

## ✨ Features

- **🪄 MagicBento Engine**: Premium GSAP-powered interactive grid with global spotlighting and glassmorphism.
- **📞 Call Lifecycle Telemetry**: Real-time visualization of call metrics, intents, and sentiment trends.
- **🧠 Knowledge Management**: Interface for managing the Hybrid RAG system (Vector DB + Knowledge Graph).
- **📋 Integrated CRM**: Holistic view of customer history, lead scores, and call outcomes.
- **📅 Slot & Booking**: Calendar-based management for service appointments and scheduling.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v20+)
- npm (v9+)

### 2. Installation
```bash
cd frontend
npm install
```

### 3. Environment Configuration
Create a `.env` file based on `.env.example`:
```bash
VITE_API_BASE_URL=http://localhost:3000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

### 4. Development Server
```bash
npm run dev
```
Access at [http://localhost:5173](http://localhost:5173).

---

## 🛠️ Tech Stack

- **Framework**: React 19 + Vite
- **Styling**: TailwindCSS 4, Framer Motion, and GSAP (GreenSock) for high-end animations.
- **Icons**: Lucide React.
- **Data Fetching**: TanStack Query (React Query) for efficient caching.
- **Charting**: Recharts for responsive analytics.
- **Communication**: `sip.js` for WebRTC-based voice calling features.

---

## 📂 Project Structure

- `src/components/magic`: The GSAP-powered MagicBento animation components.
- `src/pages`: Core views including Dashboard, CRM, Calls, and Knowledge.
- `src/hooks`: Custom hooks for API interactions and voice management.
- `src/lib`: Shared utilities and theme tokens.

---
*Crafted for visual excellence and operational efficiency.*

