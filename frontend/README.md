# ConverseAI - Animated Dashboard

Professional, high-performance admin dashboard for Voice Calling Agents. Built with React 18, TypeScript, and Vite.

## ✨ Features
- **GSAP Animations**: Premium "MagicBento" interactive grid with global spotlighting.
- **Real-time Analytics**: Visualized performance metrics and call volume trends.
- **CRM Integration**: Manage customer profiles, leads, and outcomes.
- **Slot Management**: Interactive calendar-based booking and scheduling.

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18.0 or higher)
- [npm](https://www.npmjs.com/) (v9.0 or higher)

### 2. Installation
Clone the repository and install the dependencies:
```bash
git clone https://github.com/YOUR_USERNAME/ConverseAI.git
cd ConverseAI/frontend
npm install
```

### 3. Environment Configuration
Create a `.env` file based on the example and set your backend API URL:
```bash
cp .env.example .env
```
*(Open `.env` and set `VITE_API_BASE_URL=http://localhost:8000/api`)*

### 4. Development Server
Start the development server:
```bash
npm run dev
```

The application will be available at [http://localhost:5173](http://localhost:5173).

## 🛠️ Tech Stack
- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS (v4)
- **UI Components**: Radix UI + Lucide Icons
- **Animations**: GSAP (GreenSock)
- **Charting**: Recharts
- **Data Fetching**: TanStack Query (React Query) + Axios

## 📂 Project Structure
- `src/components/layout`: Sidebar, TopBar, and Dashboard wrapper.
- `src/components/ui`: Reusable UI components including the `MagicBento` animation engine.
- `src/pages`: Main dashboard views (Overview, CRM, Calls, Slots).
- `src/lib`: Shared utilities and theme configuration.

---
Created by ConverseAI Team.
