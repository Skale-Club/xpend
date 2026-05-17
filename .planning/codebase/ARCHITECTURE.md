# Architecture

**Analysis Date:** 2026-05-17

## Pattern Overview

**Overall:** Next.js 16 App Router monolith — single deployable application combining server-rendered pages, client React components, and Route Handlers that serve the JSON API. Persistence is PostgreSQL via Prisma with the `@prisma/adapter-pg` driver adapter. Auth is delegated to Supabase (managed identity + cookie session). Optional file storage uses Supabase Storage.

**Key Characteristics:**
- Single Next.js process serves UI (`src/app/*/page.tsx`) and backend API (`src/app/api/**/route.ts`) — no separate server.
- Client-side data fetching dominates: pages are `'use client'` components that `fetch()` their own route handlers in `useEffect` (see `src/app/page.tsx`).
- Persistence flows exclusively through the singleton Prisma client in `src/lib/db.ts`. The legacy Supabase REST layer described in `CLAUDE.md` (`/api/supabase/*`) is no longer present in the tree — current API surface is Prisma-only.
- AI features (statement parsing fallback, chat assistant, categorization suggestions) are wired through Google Gemini via `@google/generative-ai` and the Vercel `ai` SDK.
- Authentication is enforced by Next.js middleware (`middleware.ts`) on every `/api/*` request and by the client-side `AuthGate` shell.
- PWA: web manifest at `src/app/manifest.ts`, service worker registered by `src/components/pwa/PWARegister.tsx`, SW source at `public/sw.js`.

## Layers

**Routing / Pages Layer:**
- Purpose: Render application screens, host client state, orchestrate fetch calls.
- Location: `src/app/*/page.tsx`
- Contains: `'use client'` page components — Dashboard (`src/app/page.tsx`), Reports (`src/app/reports/page.tsx`), Accounts (`src/app/accounts/page.tsx`), Subscriptions (`src/app/subscriptions/page.tsx`), Statements (`src/app/statements/page.tsx`), Transactions (`src/app/transactions/page.tsx`), Categories (`src/app/categories/page.tsx`), Settings (`src/app/settings/page.tsx`).
- Depends on: feature components in `src/components/<feature>/`, shared UI in `src/components/ui/`, types in `src/types/`, helpers in `src/lib/`.
- Used by: The Next.js App Router. Wrapped by `src/app/layout.tsx` (providers, sidebar, chat widget, PWA registration).

**Layout / Shell Layer:**
- Purpose: Global chrome (sidebar, providers), authentication boundary, cross-cutting UI services.
- Location: `src/app/layout.tsx`, `src/components/layout/`, `src/components/auth/`
- Contains:
  - `src/app/layout.tsx` — root layout, fonts, metadata, viewport.
  - `src/components/auth/AuthGate.tsx` — Supabase session check; renders login form or `<Sidebar /> + <main>{children}</main>`.
  - `src/components/layout/Sidebar.tsx` — primary navigation, mobile drawer, sensitive-values toggle, logout.
  - `src/components/layout/SensitiveValuesProvider.tsx` — context + `localStorage`-persisted toggle to mask monetary values.
- Depends on: Supabase browser client (`src/lib/supabaseBrowser.ts`), UI primitives.

**Feature Components Layer:**
- Purpose: Feature-scoped presentational + interactive components.
- Location: `src/components/<feature>/`
- Contains: `dashboard/` (charts, stat cards, distribution carousel, cash-flow / net-worth / spending-pace cards, filters), `transactions/TransactionList.tsx`, `statements/TimelineUpload.tsx`, `accounts/{AccountList,AccountForm}.tsx`, `categories/{CategoryTreeSelector,CategoryRules}.tsx`, `chat/{ChatWidget,ChatInterface,ChatMessage,ChatInput}.tsx`, `reports/ReportCharts.tsx`, `pwa/PWARegister.tsx`.
- Each subfolder re-exports via `index.ts`.
- Depends on: UI primitives, types, `src/lib/` helpers, route handlers via `fetch`.

**UI Primitives Layer:**
- Purpose: Headless, reusable presentation building blocks.
- Location: `src/components/ui/`
- Contains: `Button`, `Card`, `Input`, `Select`, `Modal`, `Pagination`, `Toast` + `useToast` / `ToastProvider`, `Loader` / `LoaderOverlay` / `LoaderInline`, `Skeleton` family, `ExportButton`.
- Exported via barrel `src/components/ui/index.ts`.

**API / Route Handlers Layer:**
- Purpose: HTTP entry points for all CRUD, analytics, and AI features. Implemented as Next.js Route Handlers.
- Location: `src/app/api/**/route.ts`
- Surface (current):
  - Accounts: `src/app/api/accounts/route.ts`, `src/app/api/accounts/[id]/route.ts`
  - Categories: `src/app/api/categories/route.ts`, `src/app/api/categories/[id]/route.ts`, `src/app/api/categories/seed/route.ts`
  - Categorization Rules: `src/app/api/categorization-rules/route.ts`
  - Transactions: `src/app/api/transactions/route.ts`, `src/app/api/transactions/bulk-categorize/route.ts`, `src/app/api/transactions/categorize-by-keyword/route.ts`
  - Statements: `src/app/api/statements/route.ts`, `src/app/api/statements/[id]/route.ts`, `src/app/api/statements/[id]/categorize/route.ts`, `src/app/api/statements/upload/route.ts`
  - Subscriptions: `src/app/api/subscriptions/route.ts`, `src/app/api/subscriptions/[id]/route.ts`, `src/app/api/subscriptions/detect/route.ts`
  - Dashboard / Reports: `src/app/api/dashboard/route.ts`, `src/app/api/dashboard/category-breakdown/route.ts`, `src/app/api/reports/route.ts`
  - Chat: `src/app/api/chat/route.ts`, `src/app/api/chat/schema.ts`, `src/app/api/chat/[id]/stream/route.ts`, `src/app/api/history/route.ts`
  - Settings: `src/app/api/settings/route.ts`
- Depends on: `src/lib/db.ts` (Prisma), domain helpers in `src/lib/`, Supabase service-role client for file uploads, Gemini SDK for AI features.

**Domain / Library Layer:**
- Purpose: Reusable business logic, parsing, AI orchestration — kept out of route handlers.
- Location: `src/lib/`
- Modules:
  - `db.ts` — Prisma client singleton with `PrismaPg` adapter.
  - `csvParser.ts` — flexible bank-statement CSV parsing (multi-locale headers, date/amount normalization).
  - `pdfParser.ts` — PDF statement extraction (Gemini-backed).
  - `autoCategorize.ts` — rule-based + AI categorization pipeline (`batchCategorize`).
  - `subscriptionDetector.ts` — recurring-transaction detector that normalizes descriptions, groups by cadence/amount, and upserts `Subscription` rows (populates `matchPattern`, `avgAmount`, `occurrences`, `firstSeenDate`, `lastSeenDate`).
  - `categoryHierarchy.ts`, `categoryDescendants.ts`, `categoryIcons.ts` — category tree utilities.
  - `distributionHelpers.ts` — shape category aggregates into the dashboard's `DistributionCarousel` model.
  - `searchAmount.ts` — parse amount-shaped search queries.
  - `export.ts` — CSV export helpers used by `ExportButton`.
  - `validation.ts` — input validation + `ValidationError`.
  - `http.ts` — `readArrayResponse` / `readObjectResponse` defensive fetch readers used by client pages.
  - `supabase.ts` / `supabaseBrowser.ts` — Supabase clients (REST + auth) and DB type definitions.
  - `chat/` — chat subsystem: `tools.ts`, `systemPrompt.ts`, `models.ts`, `storage.ts`, `rateLimit.ts`, `errors.ts`.

**Persistence Layer:**
- Purpose: Schema, migrations, generated client.
- Location: `prisma/schema.prisma`, `prisma/migrations/`, generated client in `src/generated/prisma/` (gitignored).
- Datasource: PostgreSQL via `@prisma/adapter-pg` (driver adapter pattern). Connection string from `DATABASE_URL`.
- Models: `Account`, `Statement`, `Category`, `CategorizationRule`, `Transaction`, `Subscription`, `Settings`, `ChatSession`, `ChatMessage`.

## Data Flow

**Statement Upload → Categorize → Persist → Detect Subscriptions:**

Implemented in `src/app/api/statements/upload/route.ts`:

1. Client posts `multipart/form-data` (file + `accountId` + `month` + `year`) to `/api/statements/upload` from `src/components/statements/TimelineUpload.tsx`.
2. `validateStatementUpload` (`src/lib/validation.ts`) enforces shape.
3. If Supabase service-role credentials are present, raw file is uploaded to the `statements` bucket at `{accountId}/{year}-{month}/{timestamp}_{filename}` and `fileUrl` captured. Failures are logged and the flow continues.
4. Parser selection by extension:
   - `.csv` → `parseCSV()` (`src/lib/csvParser.ts`, PapaParse-based).
   - `.pdf` → `parsePDF()` (`src/lib/pdfParser.ts`, Gemini-backed).
5. Statement is upserted (unique on `accountId+month+year`); on update, existing transactions for that statement are deleted first.
6. Duplicate detection: new transactions matching `(date, amount, description)` of an existing transaction in the same month/account are filtered out.
7. Surviving transactions are passed to `batchCategorize()` (`src/lib/autoCategorize.ts`) — applies `CategorizationRule` matches first (priority desc), then falls back to Gemini AI if a `geminiApiKey` is configured in `Settings`.
8. Transactions are inserted with `prisma.transaction.createMany`.
9. **Background**: `detectAndUpsertSubscriptions(accountId)` is fired without `await` to populate/refresh `Subscription` rows (sets `matchPattern`, `avgAmount`, `occurrences`, `firstSeenDate`, `lastSeenDate`, marks stale ones `inactive`).
10. Response returns `{ statement, transactionCount, totalParsed, message }`.

**Dashboard Read Path:**

Implemented in `src/app/api/dashboard/route.ts`:

1. `src/app/page.tsx` builds a `URLSearchParams` from `DashboardFilters` + pagination, then `Promise.all` fetches `/api/dashboard`, `/api/accounts`, `/api/categories`.
2. Server expands selected `categoryIds` via `expandCategoryIdsWithDescendants` so a parent category includes its children.
3. Aggregations (income/expense totals, monthly chart data, distributions, balance trend, spending pace, cash flow, net worth) are computed from a single broad query plus paginated detail query.
4. Returns `DashboardData` (see `src/types/index.ts`) including paginated `transactions[]`, `pagination` metadata, and chart-ready aggregates.
5. Drill-down: clicking a category in `DistributionCarousel` triggers `/api/dashboard/category-breakdown?parentCategoryId=...` and renders the result in a `Modal`.

**Subscription Auto-Detection:**

Implemented in `src/lib/subscriptionDetector.ts`, invoked from:
- `POST /api/subscriptions/detect` (manual trigger, optional `accountId` body).
- Background call from statement upload.

Pipeline: load recent transactions → `normalizeDescription()` strips bank prefixes, dates, reference numbers, IDs → group by normalized key → for each group with ≥ `MIN_OCCURRENCES`, evaluate amount tolerance (±10%) and interval regularity (≥70% of intervals within ±20% of the inferred cadence) → infer `BillingCycle` (DAILY/WEEKLY/MONTHLY/YEARLY) → upsert `Subscription` by `matchPattern`, populating `avgAmount`, `occurrences`, `firstSeenDate`, `lastSeenDate`, `nextPayment` → mark previously-detected subscriptions whose `lastSeenDate` exceeds `INACTIVE_MULTIPLIER × cycle` as `inactive`.

**AI Categorization:**

`src/lib/autoCategorize.ts` exposes `batchCategorize(items)`:
1. Loads active `CategorizationRule`s, ordered by `priority desc, createdAt asc`.
2. For each transaction, attempts rule match (`exact`, `contains`, `regex`).
3. Unmatched transactions are batched to Google Gemini (model from `Settings.geminiChatModel`, key from `Settings.geminiApiKey`) for AI categorization.
4. Returns `Map<index, { categoryId, categoryName, confidence, source }>`.

Manual endpoints:
- `POST /api/transactions/categorize-by-keyword` — categorize one transaction + create a `CategorizationRule` from the keyword.
- `POST /api/transactions/bulk-categorize` — apply categorization across a selection.
- `POST /api/statements/[id]/categorize` — re-run categorization on a single statement's transactions.

**Chat Subsystem:**

Implemented in `src/app/api/chat/route.ts` using Vercel `ai` SDK (`streamText`, `createUIMessageStream`) + `@ai-sdk/google`.
- Persists `ChatSession` and `ChatMessage` rows via Prisma.
- System prompt assembled in `src/lib/chat/systemPrompt.ts`.
- Tools defined in `src/lib/chat/tools.ts` give the model read access to user data (transactions, categories, etc.).
- Rate-limited via `src/lib/chat/rateLimit.ts`.
- Streaming response endpoint at `src/app/api/chat/[id]/stream/route.ts`.
- History list at `src/app/api/history/route.ts`.
- Client surface: `ChatWidget` mounted in root layout; `ChatInterface` consumes `useChat` from `@ai-sdk/react`.

**State Management:**
- No global state library. Local component state (`useState` / `useReducer`) plus React Context for cross-cutting toggles (`SensitiveValuesProvider`, `ToastProvider`).
- Auth session derived from Supabase browser client subscription in `AuthGate`.
- Server is the source of truth; clients re-fetch after mutations (most pages call a `fetchData({ silent: true })` after PUT/POST).

## Key Abstractions

**Route Handler (Prisma + NextResponse):**
- Purpose: HTTP CRUD/analytics surface.
- Examples: `src/app/api/accounts/route.ts`, `src/app/api/transactions/route.ts`, `src/app/api/dashboard/route.ts`.
- Pattern: parse `URL`/`request.json()` → build typed Prisma `where` clause → query → `NextResponse.json(...)` with try/catch returning `{ error }` on failure.

**Domain Helper Module:**
- Purpose: Encapsulate non-trivial logic outside route handlers.
- Examples: `src/lib/subscriptionDetector.ts`, `src/lib/autoCategorize.ts`, `src/lib/csvParser.ts`.
- Pattern: pure-ish functions taking primitive inputs + the shared `prisma` client; route handlers stay thin.

**Feature Component + Barrel:**
- Purpose: Group related UI per feature with a clean import surface.
- Pattern: `src/components/<feature>/<Component>.tsx` + `src/components/<feature>/index.ts` re-exporting named components.
- Consumers import via `@/components/<feature>` (e.g. `import { StatsCards, MonthlyChart } from '@/components/dashboard'`).

**Defensive Fetch Reader:**
- Purpose: Avoid runtime crashes when an API call fails or returns an unexpected shape.
- Implementation: `src/lib/http.ts` exports `readArrayResponse<T>` / `readObjectResponse<T>` that log and return `[]` / `null` on non-OK or wrong-shape payloads.
- Used pervasively in client pages alongside `Promise.all`.

**Global Loading UI Model:**
- Purpose: Consistent visual loading state across pages.
- Implementation: shared `Loader` primitive (`src/components/ui/Loader.tsx`) + route-level `src/app/loading.tsx` rendered by Next during navigation, plus page-level `if (isLoading && !data) return <Loader />`.

## Entry Points

**Browser request → page:**
- Location: `src/app/layout.tsx` → `AuthGate` → `Sidebar` + page component.
- Triggers: user navigation; Next.js routes based on `src/app/*/page.tsx`.
- Responsibilities: render shell, gate on Supabase session, mount global widgets (`ChatWidget`, `PWARegister`, `ToastProvider`, `SensitiveValuesProvider`).

**Browser request → API:**
- Location: `middleware.ts` → matched `src/app/api/**/route.ts`.
- Triggers: `fetch('/api/...')` calls from client components.
- Responsibilities: middleware validates Supabase session via cookies and rejects with 401 if no user; handler executes business logic.

**Service worker:**
- Location: `public/sw.js`, registered by `src/components/pwa/PWARegister.tsx` (production only — dev unregisters existing workers).
- Triggers: registered on first client render after mount.

**Background jobs:**
- No external scheduler. The subscription detector runs in-process, fire-and-forget, after each statement upload.

## Error Handling

**Strategy:** Try/catch in every route handler; structured `{ error: string }` JSON responses with HTTP status codes (400 for `ValidationError`, 401 from middleware, 500 default). Client uses `readArrayResponse` / `readObjectResponse` for safe parsing, and renders fallback UI (`<Loader />`, empty states, error toasts).

**Patterns:**
- `ValidationError` class from `src/lib/validation.ts` mapped to 400 in handlers.
- `ChatApiError` (`src/lib/chat/errors.ts`) for chat-specific failure surface.
- Background work (subscription detection) uses `.catch(err => console.error(...))` and never blocks the response.
- Toast notifications via `useToast` (`src/components/ui/useToast.tsx`) communicate failures and successes to users.

## Cross-Cutting Concerns

**Authentication:**
- Browser: Supabase JS client (`src/lib/supabaseBrowser.ts`), email/password sign-in inside `AuthGate`. Session subscribed via `onAuthStateChange`.
- API: `middleware.ts` uses `@supabase/ssr` `createServerClient` with cookie adapters; `getUser()` enforced on every `/api/*` route. Unauthenticated → 401.

**Logging:** `console.error` / `console.log`. No structured logger configured.

**Validation:** Hand-rolled in `src/lib/validation.ts`. Chat payloads use `zod` (`src/app/api/chat/schema.ts`).

**Configuration:** Environment variables: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` (optional override of stored value). `Settings` table stores user-facing keys (Gemini API key, chat model).

**Sensitive value masking:** `SensitiveValuesProvider` exposes a toggle persisted to `localStorage`; consuming components pass `{ hideSensitiveValues }` into `formatCurrency`.

**PWA:** Manifest declared via Next metadata (`src/app/manifest.ts`), icons in `public/icons/`, service worker `public/sw.js` registered in production.

---

*Architecture analysis: 2026-05-17*
