# External Integrations

**Analysis Date:** 2026-05-17

## APIs & External Services

**AI / LLM:**
- Google Gemini (Generative Language API)
  - SDK/Client (direct):
    - `@google/generative-ai` ^0.24.1 - used in `src/lib/pdfParser.ts` (model `gemini-1.5-flash` for multimodal PDF parsing) and `src/lib/autoCategorize.ts` (model `gemini-3-flash-preview` for category suggestion).
  - SDK/Client (chat):
    - `ai` ^6.0.116 + `@ai-sdk/google` ^3.0.43 - used in `src/app/api/chat/route.ts` (`createGoogleGenerativeAI`, `streamText`, `generateText`).
    - Allowed chat models defined in `src/lib/chat/models.ts`:
      - `gemini-2.5-flash` (label: "Gemini 2.5 Flash") - **default**
      - `gemini-3.1-flash-lite-preview` (label: "Gemini 3.1 Flash Lite (Preview)")
    - Active chat model is stored per-install in the `Settings.geminiChatModel` column (default `"gemini-2.5-flash"` at schema level; orchestrator-confirmed production value: `gemini-3.1-flash-lite-preview`).
  - Auth: API key sourced primarily from the `Settings.geminiApiKey` row in the database (configurable via the in-app Settings page → `PUT /api/settings`). Env var `GEMINI_API_KEY` is declared in `.env.example` as a fallback but `src/lib/pdfParser.ts` and `src/lib/autoCategorize.ts` read exclusively from `prisma.settings`.
  - API key validation occurs in `src/app/api/settings/route.ts` (`validateGeminiApiKey`) before persistence.
  - Rate limiting: in-memory IP bucket via `src/lib/chat/rateLimit.ts` (`checkChatRateLimit`).

**Frontend AI Chat:**
- `@ai-sdk/react` ^3.0.118 - `useChat` hook consumed in `src/components/chat/ChatInterface.tsx`, posts to `/api/chat` which streams a `createUIMessageStreamResponse`.

## Data Storage

**Databases:**
- PostgreSQL (Supabase-hosted)
  - Connection (runtime): `DATABASE_URL` - Supabase pooler `aws-REGION.pooler.supabase.com:6543` with `pgbouncer=true&connection_limit=1&sslmode=no-verify` (per `.env.example`). Orchestrator-confirmed region: `us-west-2`.
  - Connection (migrations / Prisma CLI): `DIRECT_URL` - read by `prisma.config.ts` via `dotenv/config`.
  - Client: Prisma 7.4.2 with `@prisma/adapter-pg` (`src/lib/db.ts`). Adapter constructed with `new PrismaPg({ connectionString })`. Singleton cached on `globalThis` outside production.
  - Schema: `prisma/schema.prisma` (provider `postgresql`). Generated client output: `src/generated/prisma/`.

**File Storage:**
- Supabase Storage
  - Bucket: `statements`.
  - Upload path: `src/app/api/statements/upload/route.ts` constructs `${accountId}/${year}-${MM}/${timestamp}_${file.name}` and uploads via `supabase.storage.from('statements').upload(...)`.
  - Public URL retrieved via `getPublicUrl()` and persisted to `Statement.fileUrl`.
  - Requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. If either is missing, the route silently continues without persisting a file URL (transactions still parsed and saved).
  - Bucket provisioning helpers: `scripts/create-bucket-via-api.js`, `scripts/check-bucket-status.js`, `scripts/create-storage-bucket.sql` (npm scripts `storage:create`, `storage:check`). See `STORAGE_SETUP.md`.

**Caching:**
- None (no Redis / Upstash / memcached integration detected).
- In-process Map for chat rate-limit buckets (`src/lib/chat/rateLimit.ts`) - not durable across instances.

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (email/password)
  - Server enforcement: `middleware.ts` creates a `@supabase/ssr` `createServerClient` over the incoming cookies, calls `supabase.auth.getUser()`, and returns `401 { error: 'Unauthorized' }` if there is no user. The matcher `'/api/:path*'` gates every API route.
  - If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing the middleware returns `500 { error: 'Supabase auth is not configured' }`.
  - Browser sign-in flow: `src/components/auth/AuthGate.tsx` uses `supabaseBrowser.auth.getSession()` (client from `src/lib/supabaseBrowser.ts`, built with `createBrowserClient`) and renders a login form when no session exists.
- No multi-user / row-level scoping in Prisma models - the app is effectively single-tenant; auth is a perimeter check, not a data partition.

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, Bugsnag, etc. detected).

**Logs:**
- `console.error` / `console.warn` in API routes; relies on the host platform (Vercel) for log aggregation.

**Analytics:**
- `@vercel/analytics` ^1.6.1 is installed but no `import` of it was found under `src/`; effectively unused at analysis time.

## CI/CD & Deployment

**Hosting:**
- Vercel (PWA setup committed for Vercel; `next.config.ts` serves `/sw.js` and `/manifest.webmanifest` with explicit Content-Type / cache headers).

**CI Pipeline:**
- GitHub Actions:
  - `.github/workflows/supabase-keepalive.yml` - cron `0 */6 * * *`. Pings `${SUPABASE_URL}/rest/v1/Account?select=id&limit=1` with the service-role key to keep the Supabase project from auto-pausing. Requires repo secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- No build / test / lint CI workflow detected (no test suite exists, see STACK.md).

## Environment Configuration

**Required env vars (runtime):**
- `DATABASE_URL` - Postgres pooler URL. Hard-required by `src/lib/db.ts` (throws on startup if absent).
- `NEXT_PUBLIC_SUPABASE_URL` - Required by `middleware.ts` (auth) and `src/lib/supabaseBrowser.ts` (throws at module load if missing).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Required for auth middleware and browser client.

**Required env vars (Prisma CLI / migrations):**
- `DIRECT_URL` - Read in `prisma.config.ts`.

**Optional env vars:**
- `SUPABASE_SERVICE_ROLE_KEY` - Enables statement file uploads to Supabase Storage in `src/app/api/statements/upload/route.ts`. Not declared in `.env.example` but referenced in code and in the keepalive workflow.
- `GEMINI_API_KEY` - Declared in `.env.example`; primary key source at runtime is the `Settings` table, so this env var is effectively unused by the request path. Configure via the Settings UI instead.

**Secrets location:**
- Local: `.env` (gitignored; `.env.example` is the template).
- CI/Production: Vercel project env vars + GitHub Actions repository secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

## Webhooks & Callbacks

**Incoming:**
- None. No webhook receiver endpoints under `src/app/api/`.

**Outgoing:**
- None. Calls to Gemini are user-initiated (PDF upload, chat message, manual categorize) rather than scheduled webhooks.

## Dual Backend Setup (Prisma vs Supabase routes)

The codebase historically targeted a dual-backend pattern, but the current state is:

- **Primary path (active):** `src/app/api/**/route.ts` - All real endpoints use `prisma` from `src/lib/db.ts`, which itself is configured to talk to the Supabase-hosted Postgres via the `@prisma/adapter-pg` adapter. So "Prisma routes" already write to Supabase Postgres; the database backend is unified.
- **Legacy / planned path (not implemented):** `src/app/api/supabase/**/route.ts` directories described in `CLAUDE.md` do not exist (`Glob` returned no files). The `Database` type in `src/lib/supabase.ts` and the SQL schema in `supabase/schema.sql` remain as scaffolding for a `@supabase/supabase-js`-based REST path that was never wired up to handlers.
- **Active uses of `@supabase/supabase-js`:**
  1. `src/lib/supabase.ts` - exports a singleton client typed against the `Database` interface. No imports of this `supabase` export were found in API handlers.
  2. `src/app/api/statements/upload/route.ts` - constructs its own service-role client inline for Storage uploads only.
  3. `src/lib/supabaseBrowser.ts` + `middleware.ts` + `src/components/auth/AuthGate.tsx` - Supabase Auth (cookies and session), not data access.

**Practical implication for callers:** All app fetches go to `/api/*` (Prisma → Supabase Postgres). The `NEXT_PUBLIC_BACKEND` switch mentioned in `CLAUDE.md` is stale - no code branches on it.

## AI Model Usage Summary

| Surface | File | Library | Model |
|---|---|---|---|
| Chat assistant | `src/app/api/chat/route.ts` | `ai` + `@ai-sdk/google` | `Settings.geminiChatModel` (default `gemini-2.5-flash`; production: `gemini-3.1-flash-lite-preview`) |
| Chat title generation | `src/app/api/chat/route.ts` (`generateTitleForSession`) | `ai` + `@ai-sdk/google` | Same as chat model |
| PDF statement parsing | `src/lib/pdfParser.ts` | `@google/generative-ai` | `gemini-1.5-flash` (hardcoded) |
| Auto-categorization | `src/lib/autoCategorize.ts` | `@google/generative-ai` | `gemini-3-flash-preview` (hardcoded) |
| API key validation | `src/app/api/settings/route.ts` (`validateGeminiApiKey`) | direct fetch to Gemini REST | n/a |

---

*Integration audit: 2026-05-17*
