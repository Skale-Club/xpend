# Codebase Structure

**Analysis Date:** 2026-05-17

## Directory Layout

```
xpend/
├── src/
│   ├── app/                                # Next.js App Router (pages + API)
│   │   ├── layout.tsx                      # Root layout: providers, AuthGate, ChatWidget, PWARegister
│   │   ├── page.tsx                        # Dashboard (route: /)
│   │   ├── loading.tsx                     # Route-level fallback (global Loader)
│   │   ├── globals.css                     # Tailwind v4 entry + global styles
│   │   ├── manifest.ts                     # PWA web manifest (Next metadata route)
│   │   ├── favicon.ico
│   │   ├── accounts/page.tsx               # /accounts
│   │   ├── categories/page.tsx             # /categories
│   │   ├── reports/page.tsx                # /reports
│   │   ├── settings/page.tsx               # /settings
│   │   ├── statements/page.tsx             # /statements (Upload Statements)
│   │   ├── subscriptions/page.tsx          # /subscriptions
│   │   ├── transactions/page.tsx           # /transactions
│   │   └── api/                            # Route Handlers (JSON API)
│   │       ├── accounts/{route.ts,[id]/route.ts}
│   │       ├── categories/{route.ts,[id]/route.ts,seed/route.ts}
│   │       ├── categorization-rules/route.ts
│   │       ├── chat/{route.ts,schema.ts,[id]/stream/route.ts}
│   │       ├── dashboard/{route.ts,category-breakdown/route.ts}
│   │       ├── history/route.ts
│   │       ├── reports/route.ts
│   │       ├── settings/route.ts
│   │       ├── statements/{route.ts,upload/route.ts,[id]/route.ts,[id]/categorize/route.ts}
│   │       ├── subscriptions/{route.ts,[id]/route.ts,detect/route.ts}
│   │       └── transactions/{route.ts,bulk-categorize/route.ts,categorize-by-keyword/route.ts}
│   ├── components/                         # React components grouped by feature
│   │   ├── accounts/                       # AccountList, AccountForm (+ index.ts)
│   │   ├── auth/                           # AuthGate (Supabase login boundary)
│   │   ├── categories/                     # CategoryTreeSelector, CategoryRules
│   │   ├── chat/                           # ChatWidget, ChatInterface, ChatMessage, ChatInput
│   │   ├── dashboard/                      # Charts, StatsCards, Filters, DistributionCarousel,
│   │   │                                   #   CashFlowResultCard, NetWorthCard,
│   │   │                                   #   SpendingPaceCard, TopCategoriesComparisonCard
│   │   ├── layout/                         # Sidebar, SensitiveValuesProvider
│   │   ├── pwa/                            # PWARegister (service worker bootstrap)
│   │   ├── reports/                        # ReportCharts
│   │   ├── statements/                     # TimelineUpload
│   │   ├── transactions/                   # TransactionList
│   │   └── ui/                             # Headless primitives (see below)
│   ├── lib/                                # Domain helpers, parsers, AI, clients
│   │   ├── db.ts                           # Prisma client singleton (PrismaPg adapter)
│   │   ├── supabase.ts                     # Supabase REST client + DB types
│   │   ├── supabaseBrowser.ts              # Supabase browser client (cookie-aware)
│   │   ├── csvParser.ts                    # CSV statement parser (multi-locale)
│   │   ├── pdfParser.ts                    # PDF statement parser (Gemini)
│   │   ├── autoCategorize.ts               # Rule + AI categorization pipeline
│   │   ├── subscriptionDetector.ts         # Recurring-payment detector
│   │   ├── categoryHierarchy.ts            # Category tree builders
│   │   ├── categoryDescendants.ts          # Expand category IDs to include children
│   │   ├── categoryIcons.ts                # Icon name -> Lucide icon lookup
│   │   ├── distributionHelpers.ts          # Build DistributionCarousel inputs
│   │   ├── searchAmount.ts                 # Parse amount-shaped search queries
│   │   ├── export.ts                       # CSV export utilities
│   │   ├── validation.ts                   # Hand-rolled validators + ValidationError
│   │   ├── http.ts                         # readArrayResponse / readObjectResponse
│   │   ├── utils.ts                        # formatCurrency, formatDate, etc.
│   │   └── chat/                           # Chat subsystem
│   │       ├── tools.ts                    # AI SDK tool definitions
│   │       ├── systemPrompt.ts             # System prompt assembly
│   │       ├── models.ts                   # Allowed Gemini model identifiers
│   │       ├── storage.ts                  # ChatSession/ChatMessage helpers
│   │       ├── rateLimit.ts                # Chat rate limiting
│   │       └── errors.ts                   # ChatApiError
│   ├── types/
│   │   └── index.ts                        # Shared TypeScript interfaces
│   └── generated/
│       └── prisma/                         # Generated Prisma client (gitignored)
├── prisma/
│   ├── schema.prisma                       # PostgreSQL schema (Prisma 7)
│   └── migrations/                         # Migration history
│       ├── 20260303120000_postgres_baseline/
│       └── migration_lock.toml
├── supabase/
│   ├── schema.sql                          # Supabase reference schema
│   ├── bootstrap-prisma-postgres.sql       # Bootstrap script for self-hosted Postgres
│   ├── config.toml
│   └── migrations/
├── public/
│   ├── icons/                              # PWA icons (192, 512, maskable, apple-touch)
│   ├── sw.js                               # Service worker
│   └── *.svg                               # Default Next assets
├── scripts/                                # One-off Node scripts (Supabase storage)
│   ├── check-bucket-status.js
│   ├── create-bucket-via-api.js
│   ├── create-storage-bucket.sql
│   └── test-upload.js
├── plans/                                  # Long-form feature plans (markdown)
├── volumes/                                # Self-hosted Supabase docker volumes
├── middleware.ts                           # Next middleware: Supabase auth on /api/*
├── next.config.ts
├── prisma.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── tsconfig.json
├── docker-compose.supabase.yml
├── package.json
├── README.md
├── CLAUDE.md / AGENTS.md / CHANGELOG.md / IMPROVEMENTS.md / QUICK_WINS.md / SUPABASE.md / SELF_HOSTED.md / STORAGE_SETUP.md
└── .planning/codebase/                     # GSD codebase mapping output
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router root — every page route and every HTTP endpoint.
- Contains: page files (`page.tsx`), shared route files (`layout.tsx`, `loading.tsx`), metadata routes (`manifest.ts`), and the `api/` subtree of route handlers.
- Key files: `layout.tsx` (global providers), `page.tsx` (dashboard), `loading.tsx` (global loader fallback).

**`src/app/api/`:**
- Purpose: Backend HTTP surface. One folder per resource; nested folders/segments for sub-actions.
- Contains: Only `route.ts` files (and `schema.ts` next to chat routes). No client components here.
- Conventions: Dynamic segments use `[id]`; sub-actions get their own folder (e.g. `statements/[id]/categorize/route.ts`, `subscriptions/detect/route.ts`).

**`src/components/`:**
- Purpose: All React components, grouped by feature domain.
- Contains: One folder per feature plus `ui/` for primitives. Each feature folder has an `index.ts` barrel.
- Pattern: PascalCase `.tsx` files for components; lowercase folder names matching the feature.

**`src/components/ui/`:**
- Purpose: Headless, reusable, app-agnostic primitives. Composed by every feature.
- Contains: `Button`, `Card` (+ `CardHeader`, `CardContent`), `Input`, `Select`, `Modal`, `Pagination`, `Toast`, `useToast`, `ToastProvider`, `Loader` (+ `LoaderOverlay`, `LoaderInline`), `Skeleton*`, `ExportButton`.
- Barrel: `src/components/ui/index.ts`.

**`src/lib/`:**
- Purpose: Framework-agnostic logic — domain helpers, parsers, clients, AI plumbing. Anything that should not live inside a route handler or a component.
- Contains: Flat modules at the root, plus the `chat/` subfolder for the AI assistant subsystem.

**`src/types/`:**
- Purpose: Shared TypeScript interfaces and discriminated unions used by both client and server.
- Single file: `src/types/index.ts`. Domain models (`Account`, `Transaction`, `Category`, `DashboardData`, `DashboardFilters`, `CategorySummary`, `CategoryBreakdownData`, etc.) live here. Import via `@/types`.

**`src/generated/prisma/`:**
- Purpose: Output of `prisma generate` (configured by `generator client { output = "../src/generated/prisma" }`).
- Generated: Yes.
- Committed: No (gitignored). Must be regenerated after clone or schema change.
- Imported as: `@/generated/prisma` (e.g. `import type { Prisma } from '@/generated/prisma'`).

**`prisma/`:**
- Purpose: Database schema and migrations source of truth.
- Contains: `schema.prisma` (PostgreSQL datasource, all models, enums), `migrations/` history.

**`supabase/`:**
- Purpose: Reference SQL + bootstrap for the Supabase-backed deployment / self-host scenario.
- Contains: `schema.sql`, `bootstrap-prisma-postgres.sql`, `config.toml`, `migrations/`.

**`public/`:**
- Purpose: Static assets served at the site root.
- Key files: `sw.js` (service worker), `icons/` (PWA icon set), default Next SVGs.

**`scripts/`:**
- Purpose: Operational Node scripts (Supabase storage bucket lifecycle, smoke tests).
- Run via npm scripts (`storage:create`, `storage:check`) defined in `package.json`.

**`plans/`:**
- Purpose: Human-written feature plans / roadmaps (markdown).
- Not consumed at runtime.

**`volumes/`:**
- Purpose: Persistent volumes for the self-hosted Supabase Docker stack (`docker-compose.supabase.yml`).

**`.planning/codebase/`:**
- Purpose: GSD command output — codebase reference docs (this file lives here).

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout; mounts `ToastProvider`, `SensitiveValuesProvider`, `AuthGate`, `ChatWidget`, `PWARegister`.
- `src/app/page.tsx`: Dashboard home route (`/`).
- `middleware.ts`: Auth middleware applied to `/api/:path*` via the `matcher` config.

**Configuration:**
- `next.config.ts`: Next.js config.
- `prisma.config.ts`: Prisma CLI configuration.
- `tsconfig.json`: TypeScript config; defines `@/*` path alias to `src/*`.
- `eslint.config.mjs`: ESLint flat config.
- `postcss.config.mjs`: PostCSS / Tailwind v4 config.
- `package.json`: Dependencies, npm scripts (`dev`, `build`, `db:migrate`, `db:studio`, `storage:create`, etc.).
- `docker-compose.supabase.yml`: Self-hosted Supabase stack.

**Core Logic:**
- `src/lib/db.ts`: Prisma client (read this when touching persistence).
- `src/lib/csvParser.ts` / `src/lib/pdfParser.ts`: Statement parsing.
- `src/lib/autoCategorize.ts`: Rule + AI categorization.
- `src/lib/subscriptionDetector.ts`: Recurring-payment detection.
- `src/app/api/statements/upload/route.ts`: End-to-end upload pipeline.
- `src/app/api/dashboard/route.ts`: Dashboard aggregations.
- `src/app/api/chat/route.ts`: Chat assistant (Vercel AI SDK + Gemini).

**Auth:**
- `src/components/auth/AuthGate.tsx`: Client-side gate.
- `middleware.ts`: Server-side gate for `/api/*`.
- `src/lib/supabaseBrowser.ts` / `src/lib/supabase.ts`: Supabase clients.

**Testing:**
- None present. No `*.test.*` / `*.spec.*` files and no test runner configured in `package.json`.

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `TransactionList.tsx`, `DistributionCarousel.tsx`).
- Library modules: `camelCase.ts` (e.g., `csvParser.ts`, `subscriptionDetector.ts`, `categoryHierarchy.ts`).
- Route handlers: always `route.ts` (App Router contract).
- Pages: always `page.tsx`. Loading fallbacks: `loading.tsx`.
- Barrels: `index.ts` inside each feature folder.

**Directories:**
- Feature folders: lowercase singular or plural matching the domain (`dashboard`, `accounts`, `transactions`, `subscriptions`, `chat`, `categories`).
- Dynamic API segments: `[id]`.
- Sub-actions of a resource: nested folder + own `route.ts` (e.g. `subscriptions/detect/`, `transactions/bulk-categorize/`).

**Imports:**
- Use `@/` alias (maps to `src/`): `@/lib/db`, `@/components/ui`, `@/types`, `@/generated/prisma`.
- Prefer barrel imports for components: `import { Card, Button } from '@/components/ui'`.

**Identifiers:**
- React components: `PascalCase` named exports.
- Functions/variables: `camelCase`.
- Types/interfaces/enums: `PascalCase`.
- Database enums: `SCREAMING_SNAKE_CASE` (Prisma convention — `AccountType.CHECKING`, `TransactionType.INCOME`, `BillingCycle.MONTHLY`).

## Where to Add New Code

**New Page (top-level route):**
- Create `src/app/<route>/page.tsx`. Mark `'use client'` if it uses hooks / interactivity (current convention — all pages are client components).
- Add nav entry in `src/components/layout/Sidebar.tsx`'s `navItems` array.
- Optional: add `src/app/<route>/loading.tsx` for a route-specific loader (otherwise `src/app/loading.tsx` is used).

**New API Endpoint:**
- Create `src/app/api/<resource>/route.ts` (or `src/app/api/<resource>/<action>/route.ts` for sub-actions, `src/app/api/<resource>/[id]/route.ts` for instance routes).
- Import `prisma` from `@/lib/db`; use `NextResponse.json(...)` for responses.
- Throw `ValidationError` from `@/lib/validation` for 400-class errors.
- The route is auto-protected by the Supabase auth middleware (`middleware.ts`).

**New Feature Component:**
- Create folder `src/components/<feature>/` with PascalCase `.tsx` files.
- Add an `index.ts` barrel re-exporting public components.
- Use primitives from `@/components/ui`, types from `@/types`, helpers from `@/lib`.

**New UI Primitive:**
- Add to `src/components/ui/`, export from `src/components/ui/index.ts`.
- Keep it feature-agnostic (no Prisma imports, no fetch calls).

**New Domain Helper:**
- Add a `camelCase.ts` module under `src/lib/` (or `src/lib/<subsystem>/` if it grows, following the `src/lib/chat/` precedent).
- Pure functions when possible; import `prisma` from `@/lib/db` only where DB access is needed.

**New Type:**
- Add to `src/types/index.ts`. There is no per-feature types file — everything lives in this one barrel.

**New Database Field/Model:**
- Edit `prisma/schema.prisma`.
- Run `npx prisma migrate dev --name <change>` to generate a migration under `prisma/migrations/`.
- Regenerate the client (`npm run db:generate`) so `src/generated/prisma` is up to date.

**New Categorization Rule Logic:**
- Logic in `src/lib/autoCategorize.ts`. Rule CRUD via `src/app/api/categorization-rules/route.ts`. UI in `src/components/categories/CategoryRules.tsx`.

## Special Directories

**`src/generated/prisma/`:**
- Purpose: Generated Prisma client (types + runtime).
- Generated: Yes (`prisma generate`, also run by `predev` and `build` npm scripts).
- Committed: No.

**`public/`:**
- Purpose: Static assets served verbatim at `/`.
- Generated: No (manually maintained); `sw.js` may be regenerated if a worker build is added later.
- Committed: Yes.

**`prisma/migrations/`:**
- Purpose: Forward-only migration history.
- Generated: Yes (by `prisma migrate dev` / `deploy`).
- Committed: Yes — required for `prisma migrate deploy` in production.

**`volumes/`:**
- Purpose: Docker-mounted state for self-hosted Supabase.
- Committed: Should be gitignored at runtime; do not write code here.

**`plans/`, `.planning/`:**
- Purpose: Documentation only (feature plans and GSD codebase docs). Not imported by application code.

---

*Structure analysis: 2026-05-17*
