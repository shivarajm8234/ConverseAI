# Conversational AI Backend (TypeScript)

This is the core engine for the AI-based Telegram + Voice Call platform.

## Features
- **Telegram Messaging**: Admin knowledge updates via file uploads (PDF, CSV, Excel).
- **Knowledge Base**: Semantic search (Vector DB) & entity extraction (Knowledge Graph).
- **Voice Calling**: Inbound & Outbound AI calling using Twilio & OpenAI.
- **CRM**: Lead scoring, follow-ups, and interaction history.
- **Booking System**: Service slot detection and reservation.

## Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Set up Database**:
    - Ensure PostgreSQL is running.
    - Copy `.env.example` to `.env` and fill in credentials.
    - Run Prisma migrations:
      ```bash
      npx prisma db push
      ```

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

4.  **Admin Auth (Telegram)**:
    - Set your `ADMIN_TELEGRAM_ID` in `.env`.
    - Upload files to your bot to update the knowledge system.

## Project Structure
- `src/modules/telegram`: Bot logic & admin auth.
- `src/modules/knowledge`: Document processing, Vector/Graph updates.
- `src/modules/calling`: Twilio integration, call forwarding, AI transcriptions.
- `src/modules/crm`: Lead scoring & customer history.
- `src/modules/booking`: Slot reservations.
- `src/utils/ai.ts`: AI utility functions (Embeddings, Entity extraction, Intents).
