# Codebase Concerns

**Analysis Date:** 2026-05-17

This document groups risks and tech debt by severity. Each entry cites file paths and lines where relevant so maintainers can navigate directly to the problem.

---

## High Severity

### 1. `.env` is a symlink to Google Drive

- Issue: `C:\Users\Vanildo\Dev\xpend\.env` is a symbolic link pointing at `/n/My Drive/Dev/xpend/.env`.
- Files: `.env` (symlink, repo root)
- Impact:
  - Secrets (`DATABASE_URL` containing Supabase Postgres credentials, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`) live inside Google Drive. Anyone with read access to that drive (other Google account, sync conflict, web share) gets full DB + service-role keys.
  - Drive sync conflicts can produce `.env (1)` / `.env (conflicted copy)` files. If the symlink target is rewritten by Drive, the app may load a stale/wrong secret silently.
  - `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — leak is catastrophic for the Supabase project.
  - The path uses a network/cloud mount; on cold reboot it may not be available, breaking `prisma generate` and `next dev` non-obviously.
- Fix approach:
  1. Move `.env` to a local file, remove the symlink.
  2. Rotate `SUPABASE_SERVICE_ROLE_KEY`, the Postgres password embedded in `DATABASE_URL`, and `GEMINI_API_KEY`.
  3. Audit Google Drive sharing/version history for those values.
  4. Use a secret manager (1Password CLI, `op run`, or Vercel Env) for daily dev.

### 2. Auth middleware blocks API but client-side login state is the only gate for pages

- Files:
  - `middleware.ts:1-55` — matcher is `'/api/:path*'` only.
  - `src/components/auth/AuthGate.tsx:13-149` — controls page access purely client-side via `supabaseBrowser.auth.getSession()`.
  - `src/app/layout.tsx:46-68` — `<AuthGate>` wraps all pages.
- Impact:
  - Pages (`/`, `/transactions`, `/reports`, `/subscriptions`, `/settings`) render server-side without auth. The protected UI is only hidden in the browser via React state. Source HTML + React server payload is delivered to any unauthenticated visitor before the gate runs.
  - The middleware returns JSON `401` when Supabase env vars are missing (`middleware.ts:8-13`), which means a missing config silently turns into a 401 for every API call rather than failing the build/boot — confusing to diagnose.
  - There is no server-side `auth.getUser()` call in any `src/app/api/**/route.ts` handler (verified: only the middleware does it). If middleware is ever bypassed (e.g. internal Next.js rewrites, route handlers reached via a different matcher, server actions), every record in the DB is exposed.
- Fix approach:
  - Add a `requireUser()` helper that calls `createServerClient(...).auth.getUser()` inside each route handler (defense in depth) and in a server component layout (e.g. `src/app/layout.tsx`) so pages are blocked at the server.
  - Tighten the middleware matcher / add explicit `if (!user) redirect('/login')` at the page layer.
  - Treat missing `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` as boot failures, not silent 401s.

### 3. Multi-tenant data model missing — all rows are global

- Files: `prisma/schema.prisma:32-181`
- Impact:
  - No `userId`/`tenantId` on `Account`, `Transaction`, `Statement`, `Category`, `Subscription`, `Settings`, `ChatSession`, `ChatMessage`.
  - Authentication is enforced (Supabase), but authorization is not: any signed-in user can read/modify every other user's data through `/api/*`. Today there is one user, but the moment a second account exists in Supabase Auth, this becomes a data leak.
  - `Settings` is a singleton (`id: "default"`, `prisma/schema.prisma:152-158`) holding `geminiApiKey` for everyone.
- Fix approach:
  - Add `userId String` to user-owned models and a Prisma middleware (or repository layer) that injects `where: { userId }` derived from the Supabase session.
  - Enforce RLS at the Postgres level too, since the app uses Supabase Postgres.

### 4. Statements storage bucket is created `public: true`

- Files: `scripts/create-bucket-via-api.js:37-41`
- Impact: Uploaded bank statements (CSV + PDF) are accessible by anyone who knows or guesses the URL. URLs are stored in `Statement.fileUrl` (`prisma/schema.prisma:55`) and `getPublicUrl(filePath)` is returned to the client (`src/app/api/statements/upload/route.ts:60-64`). Bank statements are highly sensitive PII (account numbers, balances, recurring billers).
- Fix approach: Recreate bucket with `public: false`, switch `getPublicUrl` to `createSignedUrl(filePath, ttl)` issued only after auth check in the API.

### 5. Money stored as `Float`

- Files:
  - `prisma/schema.prisma:39` (`initialBalance Float`)
  - `prisma/schema.prisma:104` (`Transaction.amount Float`)
  - `prisma/schema.prisma:121, 142` (`Subscription.price`, `avgAmount`)
  - `prisma/schema.prisma:74` (`Category.budget Float?`)
- Impact: Floating-point representation of currency is lossy. Sums over hundreds of transactions can drift (e.g. `0.1 + 0.2 !== 0.3`). The upload route already has to compensate with epsilon comparison (`src/app/api/statements/upload/route.ts:149`: `Math.abs(existingTx.amount - newTx.amount) < 0.01`), confirming the symptom.
- Fix approach: Migrate to `Decimal` (`@db.Decimal(14, 2)`) in Prisma. Plan migration carefully — requires re-parsing existing rows.

---

## Medium Severity

### 6. CLAUDE.md is stale (claims SQLite + dual backend)

- Files: `CLAUDE.md` lines 16, 17, 25-29, 36-40, 81-85, 120-126, 222-228
- Reality (verified in repo):
  - Database is **PostgreSQL via Supabase** — `prisma/schema.prisma:6-8` declares `provider = "postgresql"`; `src/lib/db.ts:1-19` instantiates `PrismaPg({ connectionString: DATABASE_URL })`.
  - `prisma/dev.db` does not exist; `.gitignore:35-39` still excludes it.
  - There is no `/api/supabase/*` directory. `Grep` for `supabase` under `src/app/api` matches only `src/app/api/statements/upload/route.ts` (uploads to Storage). The "dual backend" described in CLAUDE.md is fiction.
  - `src/lib/supabase.ts` exists with a `Database` type, but nothing imports it (only `supabaseBrowser.ts` for auth and the storage upload using a fresh `createClient` are used).
- Impact: Future contributors (and AI assistants reading the docs) will plan migrations, env layout, and switching logic against a backend that no longer exists.
- Fix approach: Rewrite the "Tech Stack", "Dual Backend Support", and "Switching Backends" sections of `CLAUDE.md`. Delete `SELF_HOSTED.md`/`SUPABASE.md` references if those flows are no longer supported, or update them to reflect the Supabase-only Postgres reality.

### 7. Dead code from removed Supabase backend

- Files:
  - `src/lib/supabase.ts:1-146` — hand-written `Database` type with `Insert`/`Update`/`Row` shapes that no route consumes.
  - `supabase/schema.sql` and `docker-compose.supabase.yml` (repo root) — leftover from the abandoned self-host path.
  - `volumes/` directory exists at repo root — likely a leftover Docker Compose volumes mount.
- Impact: Maintenance overhead, schema drift risk (the hand-written types do not include `Subscription`, `CategorizationRule`, `ChatSession`, `ChatMessage`, `Settings.geminiChatModel`, or `isSystem`/`budget` on `Category`), and noise during code review.
- Fix approach: Either delete the Supabase-as-DB stack entirely or restore it to parity with `prisma/schema.prisma`. Decide one source of truth.

### 8. No automated tests

- Files: Glob for `**/*.test.*` and `**/*.spec.*` outside `node_modules/` returns zero matches.
- Impact:
  - Critical money paths (CSV parsing in `src/lib/csvParser.ts`, PDF parsing in `src/lib/pdfParser.ts`, subscription detection in `src/lib/subscriptionDetector.ts`, dashboard aggregation in `src/app/api/dashboard/route.ts` — 830 lines, the largest API route) have zero regression coverage.
  - Subscription detector logic (`subscriptionDetector.ts:26-30`) hard-codes thresholds (`MIN_OCCURRENCES = 2`, `AMOUNT_TOLERANCE = 0.10`, `INTERVAL_TOLERANCE = 0.20`) and a 16-step regex normalization (`subscriptionDetector.ts:37-106`). Any change risks silent false positives across the 211 production transactions.
  - The validation library `src/lib/validation.ts` is well-structured for tests but has none.
- Fix approach: Add Vitest. Start with unit tests for `normalizeDescription` (lots of regex edge cases), `detectSubscriptions`, `parseCSV` (multilingual headers, decimal/comma separators), and `expandCategoryIdsWithDescendants`.

### 9. Subscription detector — false-positive and dedup risk

- Files: `src/lib/subscriptionDetector.ts:316-451` (`detectAndUpsertSubscriptions`)
- Issues:
  - `MIN_OCCURRENCES = 2` (line 26) is very low. Two coincidental same-merchant purchases (Amazon, Walmart) with similar amounts within tolerance will register as "subscriptions". Combined with the 10% amount tolerance and 20% interval tolerance, false positives are likely.
  - Dedup key is `matchPattern + accountId` (line 350). If `normalizeDescription` evolves and yields a different normalized string, a duplicate detected subscription will be created for the same real merchant. There is no migration when normalization rules change.
  - The "is this a real interval" check uses `medianInterval` plus `REGULARITY_THRESHOLD = 0.70` — i.e. 30% of intervals may be off-cycle and the merchant is still classified as a subscription.
  - Subscription detection runs in the background after every upload (`src/app/api/statements/upload/route.ts:197-199`) with `.catch` only logging — failures are silent.
- Fix approach: Raise `MIN_OCCURRENCES` to 3; tighten `AMOUNT_TOLERANCE` for non-rounded amounts; persist `normalizationVersion` on `Subscription` so re-runs can re-link instead of creating duplicates; surface background failures via a job status table or toast.

### 10. Generated Prisma client checked into the repo workflow

- Files: `src/generated/prisma/*` — 21 generated files, ~9.5 MB on disk.
- Status: It is `.gitignored` (`.gitignore:42`), so it is not committed (good). However it is imported directly via `src/lib/db.ts:1` (`from '../generated/prisma'`) and referenced everywhere else (`src/generated/prisma` referenced in `prisma/schema.prisma:3`).
- Impact:
  - Fresh clones break until `npm install` (which runs `predev` → `prisma generate` per `package.json:6,8`) — okay, but Vercel/CI must do this too.
  - Importing from `@/generated/prisma` in `src/lib/subscriptionDetector.ts:2` and `src/app/api/subscriptions/route.ts:3` means types break the moment anyone forgets to regenerate after a schema change.
  - The TODO comments grep-result hits inside `src/generated/prisma/runtime/client.d.ts` (3 hits) are noise but they prove the generated folder is being scanned by lint/search.
- Fix approach: Either (a) use the standard `@prisma/client` output location and import from there, or (b) add `src/generated/**` to `.eslintignore` / `tsconfig` `exclude` to keep tooling out of it. Document the regeneration step prominently in README.

### 11. Ad-hoc `scripts/` folder with privileged operations

- Files:
  - `scripts/create-bucket-via-api.js` — uses `SUPABASE_SERVICE_ROLE_KEY`, creates a **public** bucket (see High #4).
  - `scripts/check-bucket-status.js`
  - `scripts/create-storage-bucket.sql`
  - `scripts/test-upload.js`
- Impact:
  - Plain `.js` (no TypeScript), uses `require('dotenv').config()` (line 5) to load secrets from the Google-Drive `.env`.
  - No idempotency guards beyond a `listBuckets()` check.
  - Wired into `package.json:18-19` as `npm run storage:create` / `storage:check`, so they can be run by anyone with repo access.
- Fix approach: Move these into a typed `scripts/` directory with explicit env validation (e.g. zod) and out of `package.json` `scripts` for accidental runs, or convert to one-off SQL migrations.

### 12. PWA service worker — completeness gaps

- Files: `public/sw.js:1-113`, `src/app/manifest.ts:1-53`, `next.config.ts:5-37`, `src/app/layout.tsx:62` (`<PWARegister />`).
- Working:
  - Manifest + icons exist (`public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`).
  - `next.config.ts` sets correct headers for `sw.js` and `manifest.webmanifest`.
  - Offline fallback HTML is inlined (`public/sw.js:89-97`).
- Gaps:
  - `APP_SHELL` (`public/sw.js:2-10`) does not precache any built JS/CSS or actual page routes. The shell is just icons + favicon + `/`. After a navigation while offline, only the root page is reliably available.
  - There is no service-worker versioning/update notification. Bumping `CACHE_NAME = "xpend-pwa-v1"` (line 1) requires a manual constant change for every deploy.
  - All `/api/*` requests are skipped (line 50) — correct for freshness but means the app is unusable offline (no cached data).
  - No background sync, no install prompt UI.
- Fix approach: Adopt a builder (Workbox / `@serwist/next`) or precache `_next/static/*` via a build step. Add version-bump automation and a "new version available" toast.

### 13. Singleton `Settings.id = "default"` holds API keys for the whole app

- Files: `prisma/schema.prisma:152-158`, `src/app/api/settings/route.ts:9-50, 140-150`.
- Impact: When multi-user lands (see High #3), every user shares one `geminiApiKey` and one `geminiChatModel`. The API key is stored unencrypted in Postgres.
- Fix approach: Move keys per-user (`Settings.userId @unique`). Consider encryption-at-rest (`pgcrypto`) or moving keys to env vars only.

### 14. Server-side input parsing trusts `parseInt`/`parseFloat` defaults

- Files: 21 `parseInt|parseFloat` occurrences across 9 API routes. Specifically:
  - `src/app/api/statements/upload/route.ts:15-16` — `parseInt(formData.get('month') as string)` returns `NaN` when missing, then is silently passed to `validateStatementUpload` which catches it.
  - `src/app/api/transactions/route.ts:70-71` — `parseInt(limit)` / `parseInt(offset)` without `radix` argument (lint smell but works).
  - `src/app/api/accounts/route.ts:30` — `parseFloat(body.initialBalance) || 0` silently coerces invalid input to `0`, masking client bugs.
- Impact: Inconsistent invalid-input handling. Some routes return `400` via `ValidationError`, others silently default. Hard to debug for end users.
- Fix approach: Replace ad-hoc parsing with Zod schemas (zod is already a dependency: `package.json:43`). The `chat` route already does this (`src/app/api/chat/schema.ts`) — extend the pattern.

### 15. Statement upload deletes prior transactions before re-parse

- Files: `src/app/api/statements/upload/route.ts:72-82`
- Impact: When re-uploading a statement for the same `accountId+month+year`, all transactions tied to that statement are deleted (line 79-81) — including any manual category corrections, notes, and `isRecurring` flags the user set. The dedup logic (lines 124-152) then re-inserts non-duplicates, but only based on `(date, amount, normalized description)`, losing user edits.
- Fix approach: Match by `(date, amount, description)` and merge updates instead of delete+reinsert, preserving `categoryId`, `notes`, `isRecurring`.

### 16. CSV → DB amounts use floating-point comparison everywhere

- Files: `src/app/api/statements/upload/route.ts:149` (`Math.abs(existingTx.amount - newTx.amount) < 0.01`), `src/lib/searchAmount.ts` (used in `src/app/api/transactions/route.ts:56-62`).
- Impact: Symptom of the `Float` schema choice (High #5). The hard-coded epsilon `0.01` will fail for currencies with more than 2 decimals (BTC, fuel pricing).

---

## Low Severity

### 17. Large client components

- Files:
  - `src/app/reports/page.tsx` — 1451 lines.
  - `src/components/transactions/TransactionList.tsx` — 925 lines.
  - `src/app/api/dashboard/route.ts` — 830 lines.
  - `src/app/subscriptions/page.tsx` — 769 lines.
  - `src/app/api/reports/route.ts` — 644 lines.
- Impact: Hard to test, easy to introduce regressions. Dashboard route in particular concentrates pagination, filtering, aggregation, and trend calculation in one handler.
- Fix approach: Extract pure aggregation helpers to `src/lib/dashboard/` and unit-test them.

### 18. Error handling — inconsistent leaks of internals

- Files:
  - `src/app/api/settings/route.ts:131-135` — exposes raw `error.message` in development, opaque in production (good).
  - `src/app/api/statements/upload/route.ts:212-214` — returns `error.message` unconditionally, regardless of environment.
  - `src/app/api/chat/route.ts:265-273` — uses `ChatApiError` taxonomy (good pattern).
- Impact: Statement upload may leak DB error strings (constraint names, table names) to the client.
- Fix approach: Standardize on `ChatApiError`-style typed errors across all routes.

### 19. `console.error` is the only logging

- 45 occurrences across 21 API route files. There is no structured logger (pino, winston) and no log shipping.
- Impact: On Vercel, errors are visible in the dashboard but not searchable by request ID; in production debugging is anecdotal.
- Fix approach: Adopt `pino` with `pino-pretty` in dev; add `requestId` middleware.

### 20. Singleton Prisma client guard in dev only

- File: `src/lib/db.ts:4-18`.
- Impact: Correct pattern, but each Next.js HMR cycle still risks creating a second client if env vars change. Minor.

### 21. Migration history thin

- File: `prisma/migrations/20260303120000_postgres_baseline/` — one baseline migration only.
- Impact: All schema evolution since 2026-03-03 lives in `schema.prisma` without migration records. Re-deploying to a fresh DB will work, but rolling back specific changes is impossible.
- Fix approach: From this point forward, every schema edit must go through `npm run db:migrate`.

### 22. `next.config.ts` hardcodes a dev origin

- File: `next.config.ts:4` — `allowedDevOrigins: ["192.168.56.1"]`.
- Impact: One developer's LAN IP committed to the repo; harmless but noisy.

### 23. Auth UI is bilingual / mixed branding

- File: `src/components/auth/AuthGate.tsx:102, 109` — labels say "Xpend Login" / "Supabase Auth sign-in", exposing the underlying provider to end users.
- Impact: Minor UX leak.

### 24. No duplicate-statement detection at the file level

- Files: `src/app/api/statements/upload/route.ts:72-82`.
- The upsert by `(accountId, month, year)` (`prisma/schema.prisma:59`) prevents re-uploading the same month, but uploading the same transactions split across two different statement files (or with a different month label) bypasses dedup. The transaction-level dedup at line 145-152 helps but matches only exact `(date, amount, description)`. Banks routinely vary the description (`*1234` suffix, settle dates) which would slip through.
- Fix approach: Use the same `normalizeDescription` already implemented for subscription detection (`src/lib/subscriptionDetector.ts:37`) when computing the dedup key.

### 25. README / docs sprawl

- Repo root contains: `README.md`, `CLAUDE.md`, `AGENTS.md`, `CHANGELOG.md`, `IMPROVEMENTS.md`, `QUICK_WINS.md`, `SELF_HOSTED.md`, `STORAGE_SETUP.md`, `SUPABASE.md`. Many overlap and at least three (`CLAUDE.md`, `SELF_HOSTED.md`, `SUPABASE.md`) are partially stale.
- Fix approach: Consolidate. Move long-form planning under `plans/` (which already exists with `ROADMAP.md`, `QUICK-WINS.md`, etc.) and keep the root to `README.md` + `CHANGELOG.md`.

### 26. Categorize endpoint trains AI from any input

- File: `src/app/api/transactions/bulk-categorize/route.ts:24-35`
- The route picks the **first** transaction in the array (`transactionIds[0]`, line 27) to feed `learnFromCorrection`, regardless of whether the descriptions of the other transactions match. Bulk-categorizing a mixed batch trains the model on one arbitrary representative.
- Fix approach: Either learn from every distinct description in the batch, or only learn when all selected transactions share a normalized description.

---

## Cross-Cutting: What Tests Would Catch

Adding tests on these files would address most of the High/Medium concerns above:

| File | Why |
|------|-----|
| `src/lib/subscriptionDetector.ts` | False positives, dedup, normalization regressions (concerns 9, 16) |
| `src/lib/csvParser.ts` | Multi-format parsing, amount precision (concern 5) |
| `src/lib/validation.ts` | Already pure, easiest win |
| `src/app/api/statements/upload/route.ts` | Dedup correctness, edit preservation (concern 15) |
| `src/app/api/dashboard/route.ts` | 830 lines, central aggregator (concern 17) |
| Auth middleware + a sample route | Verify defense-in-depth once added (concerns 2, 3) |

---

*Concerns audit: 2026-05-17*
