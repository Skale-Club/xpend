# AGENTS.md

## Project Overview

This repository is a personal spending tracker built with Next.js App Router.

- Frontend: Next.js 16, React 19, Tailwind CSS 4
- Backend: Next.js route handlers under `src/app/api`
- Primary database: Prisma + SQLite (`prisma/dev.db`)
- Optional backend path: Supabase routes under `src/app/api/supabase`
- AI integration: Google Gemini for PDF parsing and category suggestions

The default `README.md` is still the scaffolded Next.js template. Use the source tree as the canonical reference for how the app works.

## Key Domain Concepts

- `Account`: bank account, card, cash wallet, etc.
- `Statement`: uploaded monthly statement tied to an account
- `Transaction`: income, expense, or transfer
- `Category`: user/system category for transactions
- `CategorizationRule`: keyword-based auto-categorization rule
- `Settings`: singleton app settings, currently used for Gemini API key storage

Schema is defined in `prisma/schema.prisma`.

## Important Paths

- `src/app/page.tsx`: main dashboard
- `src/app/accounts/page.tsx`: accounts management
- `src/app/transactions/page.tsx`: transactions page
- `src/app/statements/page.tsx`: statement upload flow
- `src/app/categories/page.tsx`: categories and rules management
- `src/app/settings/page.tsx`: app settings, including Gemini key
- `src/app/api/*`: Prisma-backed API routes used by the main UI
- `src/app/api/supabase/*`: alternate Supabase-backed API routes
- `src/lib/db.ts`: Prisma client setup
- `src/lib/supabase.ts`: Supabase client setup
- `src/lib/csvParser.ts`: CSV statement parsing
- `src/lib/pdfParser.ts`: Gemini-backed PDF parsing
- `src/lib/autoCategorize.ts`: rule-based and AI-assisted categorization

## Local Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Useful database commands:

```bash
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
```

Lint:

```bash
npm run lint
```

## Environment Notes

The project expects a local `.env` file. See `.env.example` for the expected shape.

Relevant environment variables include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The Gemini API key is not read from environment variables in the main parsing flow. It is stored in the `Settings` table and loaded from the database by `src/lib/pdfParser.ts` and `src/lib/autoCategorize.ts`.

## Architecture Notes

- The main UI currently calls `/api/*` routes, not `/api/supabase/*`.
- Prisma is configured with the `@prisma/adapter-libsql` adapter and points to `prisma/dev.db`.
- Statement upload supports CSV and PDF:
  - CSV is parsed heuristically based on common bank column names.
  - PDF is sent to Gemini for extraction and then normalized into transactions.
- Batch auto-categorization uses rules only to avoid AI rate limits.
- Individual AI category suggestion is only used as a fallback when no rule matches and a Gemini key exists.

## Current Known Issues

- `npm run lint` is now clean (as of 2026-03-04).
- Dashboard category aggregation bug has been fixed.
- Gemini model name has been updated to `gemini-1.5-flash`.
- All React hook lint errors have been resolved.

### Minor Issues Remaining

- Transaction List UI loads all 50 items at once (could use infinite scroll)
- No loading skeletons (just spinners)
- No optimistic updates for better perceived performance

## Working Conventions

- Prefer extending the Prisma-backed `/api/*` routes unless there is a specific reason to work on the Supabase path.
- Keep UI changes aligned with the existing component structure under `src/components`.
- When changing parsing behavior, test both import logic and downstream categorization behavior.
- Be careful with duplicate detection in statement uploads; it intentionally skips transactions matching date, amount, and normalized description.
- Do not assume documentation files reflect the code exactly; verify against source.

## Recommended First Checks Before Editing

1. Inspect `git status` to see whether the working tree is already dirty.
2. Read the relevant page and matching API route together.
3. Run `npm run lint` before and after substantial changes.
4. If touching data flow, verify the Prisma schema and API response shape match the consuming page/component.
