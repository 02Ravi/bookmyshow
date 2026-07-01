# BookMyShow

Monorepo for the BookMyShow ticketing platform.

## Architecture

BookMyShow is a modular monolith: a NestJS backend handles catalog, reservations, bookings, auth, and agent-chat in domain modules backed by Postgres (Prisma), while Redis is used for ephemeral hold/session coordination and short-lived agent turn locks. Real-time seat updates are emitted through Socket.IO room events (`show:{showId}`), and the agent layer composes tool calls plus an enrichment pass to always return UI-ready prompts to the frontend.

## Structure

```
bookmyshow/
├── backend/    # NestJS API (port 3001)
├── frontend/   # Next.js app (port 3000)
└── docker-compose.yml
```

## Prerequisites

- Node.js 20+
- Docker
- A Supabase project (Postgres database)

## Getting Started

### 1. Start Redis

```bash
docker compose up -d
```

This starts Redis on `localhost:6379` with a persistent volume.

### 2. Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL` to your Supabase Postgres connection string. This file is not committed to version control.

```bash
npm install
npx prisma generate   # generates client to src/generated/prisma (required after install)
npx prisma migrate deploy   # apply migrations to Supabase
npm run prisma:seed         # seed movies, theatres, shows, etc.
npm run start:dev
```

The API runs at [http://localhost:3001](http://localhost:3001).

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Environment Variables

### Backend (`backend/.env`)

| Variable                  | Default                  | Description |
|---------------------------|--------------------------|-------------|
| `PORT`                    | `3001`                   | HTTP server port |
| `DATABASE_URL`            | *(required)*             | Supabase Postgres connection string |
| `REDIS_HOST`              | `localhost`              | Redis host |
| `REDIS_PORT`              | `6379`                   | Redis port |
| `CORS_ORIGINS`            | `http://localhost:3000,http://localhost:3002` | Comma-separated allowed browser origins for API CORS |
| `FRONTEND_URL`            | `http://localhost:3000`  | Legacy single-origin CORS fallback when `CORS_ORIGINS` is unset |
| `RECONCILE_CRON_INTERVAL` | every minute             | Cron for orphaned hold cleanup (see `backend/.env.example`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | *(required for agent)* | Gemini key used by `/agent/chat` |
| `DEMO_FAST_HOLD`          | `false`                  | Forces short (10s) reservation holds for demos |

### Frontend (`frontend/.env.local`)

| Variable               | Default                  | Description |
|------------------------|--------------------------|-------------|
| `NEXT_PUBLIC_API_URL`  | `http://localhost:3001`  | Backend API base URL |

## Notes

- Postgres is hosted on Supabase — it is not included in `docker-compose.yml`.
- Only Redis runs via Docker locally.
- Health check: `GET /health` on the backend returns `{ "status": "ok" }`.
- Implemented flows: movie/show catalog, live seat map (WebSockets), seat holds with expiry, booking checkout, and a cron backstop for abandoned holds.
