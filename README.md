# Xpend — Personal Finance Tracker

A Next.js app for tracking accounts, bank statements, transactions, credit-card invoices, subscriptions and financial goals — with AI-powered categorization, a financial chat assistant, a durable "financial memory" system and a built-in MCP server for external agents.

## Features

- **Accounts** — checking, savings, credit cards, cash; balances derived from initial balance + transactions
- **Statements** — CSV/PDF upload with flexible parsing (multi-language headers, US/EU date and amount formats), merge-on-reupload dedup that preserves your edits
- **Credit cards** — materialized invoices (faturas), installment grouping, billing cycles, available-limit tracking
- **Transactions** — list, filter, search, bulk categorization (rules + Gemini/OpenRouter AI)
- **Subscriptions** — automatic detection of recurring charges after each upload
- **Goals** — savings/travel/debt/emergency-fund goals, contributions, scenarios, snowball/avalanche debt strategies, AI planner
- **Chat assistant** — streaming chat with tool access to your data (via OpenRouter)
- **Financial memory & journey** — AI-extracted memories with a human review queue, timeline, health checks
- **MCP server** — JSON-RPC 2.0 endpoint with per-tool token permissions and audit log
- **Reports & dashboard** — monthly trends, category breakdowns, balance trend, net worth, spending pace
- **PWA** — installable, offline fallback, dark/light theme

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · Prisma 7 + PostgreSQL (Supabase) · Supabase Auth/Storage · Vercel AI SDK + OpenRouter · Recharts

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (see .env.example)
cp .env.example .env

# 3. Generate the Prisma client
npx prisma generate

# 4. Run migrations (against your Supabase/PostgreSQL database)
npm run db:migrate

# 5. Start the dev server (port 6112)
npm run dev
```

Open [http://localhost:6112](http://localhost:6112).

### Required environment variables

```bash
DATABASE_URL=postgresql://...            # Supabase PostgreSQL connection string
NEXT_PUBLIC_SUPABASE_URL=https://...     # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # Supabase anon key (Auth)
SUPABASE_SERVICE_ROLE_KEY=...            # Server-side only (Storage signed URLs)
```

The OpenRouter API key for AI features is set in the app's Settings page (stored in the database).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server on port 6112 |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm test` | Unit tests (Vitest) |
| `npm run db:migrate` | Prisma migrations |
| `npm run db:studio` | Prisma Studio |

## Documentation

- [CLAUDE.md](CLAUDE.md) — architecture and development guide
- [ANALISE_SISTEMA.md](ANALISE_SISTEMA.md) — full system analysis (pt-BR)
- [SELF_HOSTED.md](SELF_HOSTED.md) — self-hosting with the bundled Supabase docker-compose
- [STORAGE_SETUP.md](STORAGE_SETUP.md) — statement storage bucket setup
- [CHANGELOG.md](CHANGELOG.md)

## Security notes

- All `/api/*` routes require a Supabase session (middleware) except the MCP protocol endpoints, which use their own Bearer-token auth with per-tool permissions.
- The app is currently **single-user**: there is no per-user row isolation. Keep sign-ups disabled in your Supabase project, or any authenticated account can access all data.
- The bundled `docker-compose.supabase.yml` ships with demo secrets — replace them before any production use (see SELF_HOSTED.md).
