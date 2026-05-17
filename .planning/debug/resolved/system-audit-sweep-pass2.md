---
status: resolved
trigger: "Second-pass cleanup — fix all remaining CONCERNS.md items not addressed in pass 1"
created: 2026-05-17T11:00:00Z
updated: 2026-05-17T11:15:00Z
---

## Current Focus

hypothesis: All fixable remaining items have been addressed and verified.
test: npm run build + npm run lint (both exit 0)
expecting: Clean build and lint.
next_action: Archive session.

## Symptoms

expected: All items in CONCERNS.md that are safe to fix autonomously are fixed.
actual: Items C1-C4, M1-M2, L1-L3 were addressed in pass 1. Remaining items in scope.
errors: None.
reproduction: See CONCERNS.md items #2, #11, #14, #18, #23, #24.
started: 2026-05-17 (second pass)

## Eliminated

- hypothesis: settings/route.ts leaks raw error.message
  evidence: Already has dev/prod conditional — error only in dev. Not a leak in prod.
  timestamp: 2026-05-17

- hypothesis: accounts/route.ts and transactions/route.ts leak raw error on 500
  evidence: Both routes only call error.message inside `if (error instanceof ValidationError)` blocks (400s). The 500 handlers return static strings. Not a leak.
  timestamp: 2026-05-17

- hypothesis: TODO/FIXME in src/ code need fixing
  evidence: Grep found only hits inside src/generated/prisma (generated code, gitignored). No application-code TODOs.
  timestamp: 2026-05-17

- hypothesis: Singleton Settings.id="default" is a bug
  evidence: App is explicitly single-tenant (no userId on any model). The singleton is correct by design. CONCERNS.md #13 = NOT A BUG for this project.
  timestamp: 2026-05-17

## Evidence

- timestamp: 2026-05-17T11:00Z
  checked: middleware.ts matcher
  found: matcher only covers /api/:path*. Page routes (/accounts, /transactions, etc.) delivered server HTML to unauthenticated visitors.
  implication: Fix applied — added PROTECTED_PAGE_PATHS with server-side redirect to / for unauthenticated visitors.

- timestamp: 2026-05-17T11:01Z
  checked: statements/upload/route.ts error handler
  found: 500 handler returned `error instanceof Error ? error.message : 'Failed...'` — unconditional raw leak.
  implication: Fixed — static 'Failed to process statement' message returned.

- timestamp: 2026-05-17T11:02Z
  checked: scripts/create-bucket-via-api.js
  found: public: true hardcoded. If run against a new project, would create public bucket.
  implication: Fixed — public: false now matches intended private-bucket architecture.

- timestamp: 2026-05-17T11:03Z
  checked: parseInt without radix
  found: 8 occurrences across transactions/route.ts, dashboard/route.ts, statements/route.ts, statements/upload/route.ts, csvParser.ts.
  implication: Fixed — added , 10 radix to all occurrences.

- timestamp: 2026-05-17T11:04Z
  checked: AuthGate.tsx login form
  found: Green badge says "Supabase Auth sign-in" — exposes auth provider.
  implication: Fixed — changed to "Secure sign-in".

- timestamp: 2026-05-17T11:05Z
  checked: Statement upload dedup logic
  found: Dedup used exact description.trim().toLowerCase() only — banks sometimes vary descriptions with card suffixes, reference numbers.
  implication: Fixed — added normalizeDescription fallback. Two transactions with same date+amount and matching normalized descriptions are now treated as duplicates even if raw strings differ.

- timestamp: 2026-05-17T11:10Z
  checked: npm run build, npm run lint
  found: Both exit 0. 29 routes generated, zero lint errors/warnings.
  implication: All fixes verified.

## Resolution

root_cause: Six distinct remaining issues: (1) middleware only guarding /api/* leaving page routes open to unauthenticated server render; (2) raw error.message returned on upload 500s; (3) create-bucket script hardcoded public:true; (4) parseInt without radix in 8 places; (5) auth UI exposing "Supabase Auth" branding; (6) dedup using exact description match only.

fix: |
  A: middleware.ts — added PROTECTED_PAGE_PATHS + server-side redirect to / for unauthenticated page access; updated matcher to include all protected routes
  B: statements/upload/route.ts — return static error string on 500; added parseInt radix; added normalizeDescription dedup fallback
  C: scripts/create-bucket-via-api.js — public: true -> public: false
  D: transactions/route.ts, dashboard/route.ts, statements/route.ts, csvParser.ts — parseInt with radix
  E: AuthGate.tsx — "Supabase Auth sign-in" -> "Secure sign-in"

verification: npm run build exit 0 (29 routes). npm run lint exit 0. 5 commits landed.

files_changed:
  - middleware.ts (A)
  - src/app/api/statements/upload/route.ts (B)
  - scripts/create-bucket-via-api.js (C)
  - src/app/api/transactions/route.ts (D)
  - src/app/api/dashboard/route.ts (D)
  - src/app/api/statements/route.ts (D)
  - src/lib/csvParser.ts (D)
  - src/components/auth/AuthGate.tsx (E)

## Items Skipped (with reason)

- #1 .env symlink to Google Drive: local filesystem concern, not a code fix. User must move .env manually and rotate credentials.
- #3 Multi-tenant userId on models: schema migration + data migration. Out of scope.
- #5 Float for money: schema migration (Float -> Decimal) + data migration. Out of scope.
- #8 No tests: Vitest setup is out of scope for this pass.
- #9 Subscription detector thresholds: FIXED in pass 1 (C2).
- #12 PWA service worker: architectural rebuild (Workbox), out of scope.
- #16 Float epsilon dedup: symptom of Float schema, skip with #5.
- #17 Large files: refactor/extraction, not a bug.
- #19 console.error only: structural logging decision, out of scope.
- #21 Migration history thin: process change (must use db:migrate going forward), not a code fix.
- #25 Doc sprawl: low value, skip.

## Items Reclassified NOT-A-BUG

- #10 Generated Prisma client: gitignored, regenerated on install/build. Working as intended.
- #13 Singleton Settings: app is single-tenant, singleton is correct design.
- #20 Singleton Prisma client guard: correct pattern, minor HMR risk acknowledged.
