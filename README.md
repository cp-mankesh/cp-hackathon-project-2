# Autonomous Delivery App

AI Engineer Hub — a Devin/Railway-style platform for autonomous ticket-driven software delivery.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, Tailwind CSS (light theme) |
| API | Fastify, Prisma, PostgreSQL |
| Orchestration | Temporal |
| Agents | OpenHands + OpenAI |
| Integrations | GitHub OAuth, Jira OAuth, webhooks |

## Features

- **Landing page** with connected projects
- **Admin panel** (Ticket Hub, Review Queue, Workflow Monitor, LLM Monitor)
- **Ticket sources**: manual, GitHub Issues, Jira
- **GitHub OAuth** — connect account and select repositories
- **Temporal workflow**: clone → branch → plan → implement → test → review loops → **human approval** → push → PR
- **Review Queue gate** — no push/PR until approved

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### One command to run everything

```bash
npm install
npm run dev
```

This single command will:

1. Create `.env` from `.env.example` if missing
2. Start Docker (Postgres, Redis, Temporal, Temporal UI)
3. Wait for infrastructure to be healthy
4. Sync the database schema (Prisma)
5. Start API, Web, and Temporal worker

| Service | URL |
|---------|-----|
| Web | http://localhost:3020 |
| API | http://localhost:4020 |
| Temporal UI | http://localhost:8080 |

### Stop everything

```bash
npm run stop
```

### Environment

```bash
cp .env.example .env
# Edit .env — set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, OPENAI_API_KEY
```

Default ports **3020** (web) and **4020** (api) avoid conflicts with other local projects on 3000/3001.

### Manual steps (optional)

```bash
npm run docker:up    # infrastructure only
npm run dev:apps     # app services only (skip docker/db bootstrap)
npm run db:push      # sync schema manually
```

- **Dev login**: http://localhost:3020/login → "Dev login (no GitHub)"
- **GitHub OAuth**: set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`

## Workflow

```
Ticket Created → Worker Claims → Clone Repo → Create Branch (agent/ticket-{id})
→ Analyze Repo → Generate Plan → Implement Code ⇄ Run Tests (max retries)
→ Code Review ⇄ Implement (max review rounds) → Awaiting Human Review
→ [Approve] → Commit + Push → Create PR → Completed
```

## GitHub OAuth App Setup

1. Go to https://github.com/settings/developers
2. New OAuth App
3. Homepage URL: `http://localhost:3020`
4. Callback URL: `http://localhost:4020/api/auth/github/callback`
5. Copy Client ID and Secret to `.env`

## Project Structure

```
apps/web/          Next.js frontend
apps/api/          Fastify REST API
workers/temporal/  Temporal workflows & activities
packages/shared/   Shared types
packages/db/       Prisma schema
packages/agents/   OpenAI + OpenHands wrappers
```

## License

MIT
