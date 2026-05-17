# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## system-audit-sweep — broad codebase audit: invalid Gemini model, public bucket, re-upload data loss, ESLint errors, stale docs
- **Date:** 2026-05-17
- **Error patterns:** gemini model, subscriptions false positive, statements bucket public, deleteMany transactions, bulk-categorize, eslint no-explicit-any, CLAUDE.md sqlite dual-backend, allowedDevOrigins, supabase client dead code
- **Root cause:** Multiple independent issues: invalid hardcoded Gemini model name causing silent AI categorization failure; subscription MIN_OCCURRENCES=2 producing 40% false positives; statements Supabase bucket created with public=true exposing bank statement PII; re-upload route deleting all transactions before re-parse destroying user edits; bulk-categorize only calling learnFromCorrection on first transaction ID; 22 ESLint errors blocking CI; CLAUDE.md describing non-existent SQLite/LibSQL/dual-backend stack; hardcoded LAN IP in next.config.ts; dead createClient export in src/lib/supabase.ts
- **Fix:** C1: autoCategorize reads geminiChatModel from Settings. C2: MIN_OCCURRENCES 2→3, 7 false subs inactivated via DB script. C3: bucket set private, upload stores filePath, new signed-url endpoint. C4: removed deleteMany before re-parse, dedup includes existing statement transactions. M1: learnFromCorrection for all distinct descriptions. M2: typed CategoryNode interface, widened Recharts formatter, escaped entities, removed unused imports. L1: rewrote CLAUDE.md. L2: removed hardcoded IP. L3: removed dead createClient export.
- **Files changed:** src/lib/autoCategorize.ts, src/lib/subscriptionDetector.ts, src/app/api/statements/upload/route.ts, src/app/api/statements/[id]/signed-url/route.ts, src/app/api/transactions/bulk-categorize/route.ts, src/app/api/reports/route.ts, src/app/reports/page.tsx, src/components/categories/CategoryRules.tsx, src/components/dashboard/SpendingPaceCard.tsx, src/app/accounts/page.tsx, src/app/transactions/page.tsx, CLAUDE.md, next.config.ts, src/lib/supabase.ts
---

