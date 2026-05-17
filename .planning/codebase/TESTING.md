# Testing Patterns

**Analysis Date:** 2026-05-17

## Test Framework

**None.** The project has **no automated testing infrastructure** of any kind.

**Evidence:**
- `package.json` `scripts` block contains: `predev`, `dev`, `build`, `start`, `lint`, `db:generate`, `db:migrate`, `db:migrate:deploy`, `db:studio`, `db:reset`, `db:seed`, `db:push`, `storage:create`, `storage:check`. **No `test`, `test:watch`, `test:coverage`, `e2e`, `playwright`, `cypress`, or similar script exists.**
- `package.json` `devDependencies` lists `@tailwindcss/postcss`, `@types/node`, `@types/papaparse`, `@types/react`, `@types/react-dom`, `dotenv`, `eslint`, `eslint-config-next`, `tailwindcss`, `typescript`. **No `jest`, `vitest`, `mocha`, `chai`, `@testing-library/*`, `playwright`, `cypress`, `@vitest/*`, or `ts-jest` present.**
- Glob for `**/*.{test,spec}.{ts,tsx,js,jsx}` returns zero matches under `src/` or project root — all matches live exclusively under `node_modules/`.
- Glob for `**/__tests__/**` returns zero matches outside `node_modules/`.
- No `jest.config.*`, `vitest.config.*`, `playwright.config.*`, `cypress.config.*`, or `vitest.workspace.*` files exist at the repo root or anywhere in `src/`.

## CI Pipeline

**No build/test CI.** Only one workflow exists:
- `.github/workflows/supabase-keepalive.yml` — cron job that pings the Supabase REST API every 6 hours to prevent the free-tier project from being paused. It does NOT run tests, lint, type-check, or build. There is no PR check or main-branch verification.

## Manual / Ad-Hoc Test Artifacts

The `scripts/` directory contains operational scripts (not tests), explicitly ignored by ESLint via `eslint.config.mjs` line 16 (`scripts/**`):

- `scripts/check-bucket-status.js` — manual verification that the Supabase Storage `statements` bucket exists. Run with `npm run storage:check`.
- `scripts/create-bucket-via-api.js` — provisions the Supabase Storage bucket. Run with `npm run storage:create`.
- `scripts/create-storage-bucket.sql` — SQL counterpart for direct DB execution.
- `scripts/test-upload.js` — **despite the "test" prefix, this is an ad-hoc manual smoke script**, not an automated test. It hand-builds a CSV string in memory and uploads it through `@supabase/supabase-js` using the service role key (read from `.env` via `dotenv`). No assertions; success/failure is inspected visually via `console.log` output (emoji-prefixed messages like `🧪 Testing Supabase Storage upload...`, `❌ Missing environment variables!`). Invoked with `node scripts/test-upload.js`.

These scripts use CommonJS (`require()`), live outside the TypeScript project, and are not type-checked.

## Type Checking as Partial Safety Net

The project relies on `strict: true` TypeScript (`tsconfig.json`) and ESLint (`npm run lint`) as the only automated verification. `npm run build` invokes `prisma generate && next build`, which performs a full TypeScript type-check as a side effect — this is the closest thing to a "test suite" the project has.

## Run Commands

```bash
# There is no test command. Closest equivalents:
npm run lint    # ESLint with eslint-config-next defaults
npm run build   # Full TS type-check + Next.js production build
```

## Test File Organization

Not applicable — no test files exist.

**Recommended location IF tests are added:** Co-locate `*.test.ts(x)` files next to the module under test (Next.js default), or create `src/__tests__/` for cross-cutting integration tests. For E2E, place under `e2e/` at the repo root.

## Mocking, Fixtures, Coverage

Not applicable — none configured.

## Coverage

**None enforced.** No `--coverage` invocation, no `.nycrc`, no `coverage/` artifacts.

## Test Types Present

| Type | Status |
|------|--------|
| Unit tests | None |
| Integration tests | None |
| API route tests | None |
| Component tests | None |
| E2E tests | None |
| Visual regression | None |
| Type-check (proxy) | Yes — via `next build` and `tsc` (implicit through `--noEmit` in `tsconfig.json`) |
| Lint | Yes — `npm run lint` |

## Implications for New Work

When planning phases that touch this codebase:
1. **Do not assume a test harness exists.** New features ship without test coverage by default.
2. **Lint + build are the only gates.** Any phase that adds code must at minimum pass `npm run lint` and `npm run build` cleanly.
3. **Manual verification is the norm.** Match the pattern in `scripts/test-upload.js` if a quick smoke script is needed for a new integration — place it under `scripts/` with `console.log`-based output, and ensure it stays in CommonJS so the ESLint ignore continues to cover it.
4. **Introducing a test runner is a green-field decision.** If the user wants tests, propose Vitest (aligns with Vite-style ESM, fast, TS-native) or Playwright for E2E. There is no prior art to follow.
5. **High-leverage first targets if testing is introduced:** `src/lib/validation.ts` (pure functions, clear error paths), `src/lib/csvParser.ts` (complex parser with many edge cases — multiple date/amount/header formats), `src/lib/http.ts` (small, pure helpers), `src/lib/categoryDescendants.ts`, `src/lib/searchAmount.ts`.

---

*Testing analysis: 2026-05-17*
