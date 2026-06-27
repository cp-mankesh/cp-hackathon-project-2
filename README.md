# Autonomous Delivery App

AI Engineer Hub — a Devin/Railway-style platform for autonomous ticket-driven software delivery.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, Tailwind CSS (light theme) |
| API | Fastify, Prisma, SQLite |
| Orchestration | Temporal (embedded dev server) |
| Agents | OpenAI |
| Integrations | GitHub OAuth, Jira OAuth, webhooks |

## Quick Start

**Prerequisites:** Node.js 20+ only — no Docker required.

1. Clone the repo
2. Place the shared `.env` file in the project root
3. Run one command:

```bash
npm run setup
```

Or use the platform helper:

```bash
./setup.sh          # Linux / macOS
setup.bat           # Windows
```

That single command installs dependencies, starts the embedded Temporal server, creates the SQLite database, builds packages, and launches the app.

| Service | URL |
|---------|-----|
| Web | http://localhost:3020 |
| API | http://localhost:4020 |
| Temporal UI | http://localhost:8080 |

### Daily development

```bash
npm run dev
```

### Stop everything

```bash
npm run stop
```

- **Dev login**: http://localhost:3020/login → "Dev login (no GitHub)"
- **GitHub OAuth**: set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`

## Shared `.env` requirements

Your shared `.env` must use SQLite (not PostgreSQL):

```env
DATABASE_URL="file:../../../data/ados.db"
WORKSPACES_DIR=./data/workspaces
```

All other secrets (OpenAI, GitHub, etc.) stay the same.

## Optional: Docker stack

For a full Postgres + Redis stack, use `docker-compose.yml`:

```bash
npm run docker:up
# set DATABASE_URL=postgresql://ados:ados_secret@localhost:5433/ados in .env
# switch packages/db/prisma/schema.prisma provider back to postgresql
```

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
data/              SQLite DB + agent workspaces (created by setup)
```

## License

MIT
