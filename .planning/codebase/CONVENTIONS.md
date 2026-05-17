# Coding Conventions

**Analysis Date:** 2026-05-17

## TypeScript Configuration

**Strictness:** `strict: true` enabled in `tsconfig.json` (single flag — does not enumerate individual strict sub-flags, but covers `strictNullChecks`, `noImplicitAny`, etc.).

**Other notable compiler settings** (`tsconfig.json`):
- `target: ES2017`
- `module: esnext`, `moduleResolution: bundler`
- `jsx: react-jsx`
- `allowJs: true` (legacy JS scripts can coexist)
- `isolatedModules: true`
- Path alias: `@/*` -> `./src/*`

**NOT enabled** (gaps to be aware of):
- `noUncheckedIndexedAccess` — array/object access not narrowed
- `exactOptionalPropertyTypes`
- `noImplicitOverride`

## Linting

**Tool:** ESLint v9 via flat config at `eslint.config.mjs`.

**Extends:**
- `eslint-config-next/core-web-vitals`
- `eslint-config-next/typescript`

**Global ignores:**
- `.next/**`, `out/**`, `build/**`, `next-env.d.ts`
- `scripts/**` (CommonJS `require()` ad-hoc scripts)
- `src/generated/**` (Prisma generated client)

**No custom rules layered on top** — project relies entirely on Next.js defaults. No Prettier config present (formatting is implicit / editor-driven).

**Run:** `npm run lint` (just `eslint`).

## Naming Patterns

**Files:**
- React components: `PascalCase.tsx` — `Button.tsx`, `AccountList.tsx`, `TimelineUpload.tsx`, `DistributionCarousel.tsx`
- Hooks: `camelCase.tsx` prefixed `use` — `useToast.tsx`
- Library modules: `camelCase.ts` — `csvParser.ts`, `autoCategorize.ts`, `categoryDescendants.ts`, `http.ts`
- API routes: always lowercase `route.ts` inside lowercase or `[id]` segments — `src/app/api/accounts/route.ts`, `src/app/api/accounts/[id]/route.ts`
- Page components: lowercase `page.tsx` inside lowercase route folders — `src/app/accounts/page.tsx`
- Ad-hoc node scripts: `kebab-case.js` — `scripts/check-bucket-status.js`, `scripts/test-upload.js`

**Functions:**
- `camelCase` for utilities and handlers: `validateAccountData`, `readArrayResponse`, `parseSearchAmount`, `expandCategoryIdsWithDescendants`
- `PascalCase` for React components: `AccountList`, `DashboardPage`, `Button`
- Exported handler functions in API routes use UPPER HTTP verbs (Next.js requirement): `GET`, `POST`, `PUT`, `DELETE`

**Variables:**
- `camelCase` throughout: `accountId`, `dashboardData`, `filePath`
- React state pairs use standard `[value, setValue]` naming: `const [isLoading, setIsLoading] = useState(true);`

**Types & Interfaces (`src/types/index.ts`):**
- Object shapes -> `interface` in `PascalCase`: `Account`, `Transaction`, `DashboardData`, `CategoryReportNode`
- String-literal unions -> `type` in `PascalCase`: `AccountType = 'CHECKING' | 'SAVINGS' | ...`, `TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER'`
- Constant lookup tables -> `SCREAMING_SNAKE_CASE`: `ACCOUNT_TYPE_LABELS`, `ACCOUNT_TYPE_ICONS`, typed as `Record<AccountType, string>`

**Enums:** No TypeScript `enum` keyword used in `src/` (only in generated Prisma schema). String-literal unions are the chosen idiom — keep using this pattern for new domain enums.

## "use client" Usage

**38 files** carry `'use client'` directive (single-quoted, on line 1). Every interactive page and every component that uses `useState` / `useEffect` / event handlers declares it explicitly. Server-only modules (everything under `src/app/api/**/route.ts`, `src/lib/db.ts`) deliberately omit it.

**Rule:** Default to server components. Add `'use client'` only when needed (hooks, browser APIs, event handlers).

## Component Conventions

**Props pattern:** Define a local `interface ComponentNameProps` immediately above the function. See `src/components/ui/Button.tsx`:
```typescript
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  isLoading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', ... }: ButtonProps) { ... }
```

**Export style:**
- UI primitives and named feature components: `export function ComponentName(...)` (named export)
- Page components (`src/app/**/page.tsx`): `export default function PageName()` (Next.js requires default export)

**Variant styling:** Tailwind utility strings stored in lookup objects keyed by variant prop, then composed via template literal (`src/components/ui/Button.tsx` lines 21-37). No `cva` / `tailwind-variants` library — `clsx` is a dependency but used sparingly.

**Barrel exports:** UI components are imported via barrel: `import { Card, Button, Modal } from '@/components/ui'`. Feature folders (`@/components/dashboard`, `@/components/transactions`) also expose barrels.

## API Route Patterns

**Reference implementations:** `src/app/api/accounts/route.ts`, `src/app/api/transactions/route.ts`.

**Standard structure:**
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateXData, ValidationError } from '@/lib/validation';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // extract + validate query params
    validateQueryParams({ ... });
    const data = await prisma.<model>.findMany({ ... });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to fetch X:', error);
    return NextResponse.json({ error: 'Failed to fetch X' }, { status: 500 });
  }
}
```

**Required elements for every new route:**
1. Wrap body in `try / catch`.
2. Validate inputs via a helper from `src/lib/validation.ts` (throws `ValidationError`).
3. Differentiate `ValidationError` (400) from generic errors (500).
4. `console.error` with a descriptive prefix BEFORE returning the 500 response.
5. Generic 500 messages — do not leak internal error details to clients (except `src/app/api/settings/route.ts` which intentionally surfaces details in `development` only — lines 130-135).

**Indentation inconsistency:** Most routes use 2-space indentation. `src/app/api/settings/route.ts` uses 4-space. New code should follow 2-space to match the majority.

**Dynamic params:** `[id]` segments destructure params via the route handler's second arg. See `src/app/api/accounts/[id]/route.ts`.

**Backend status:** Although `CLAUDE.md` describes a "dual backend" (Prisma + Supabase), there are NO `src/app/api/supabase/*` routes in the current tree. Only the unified Prisma routes exist (Prisma is configured with the `@prisma/adapter-pg` adapter pointing at Postgres via `DATABASE_URL` — see `src/lib/db.ts`). Supabase usage is limited to file storage (`src/app/api/statements/upload/route.ts`) and auth helpers (`src/lib/supabase.ts`, `src/lib/supabaseBrowser.ts`).

## Client-Side Fetch Convention

**Convention introduced by commit `1b96685` ("Harden client fetch handling for API errors")**: All client-side JSON parsing of `fetch` responses MUST go through helpers in `src/lib/http.ts`:

- `readJsonBody(response)` — swallows `.json()` parse errors, returns `null`
- `readArrayResponse<T>(response, resourceName)` — returns `T[]` (empty array on failure), logs structured errors
- `readObjectResponse<T>(response, resourceName)` — returns `T | null`, logs structured errors

**Usage example** (`src/app/page.tsx` lines 66-76):
```typescript
const [dashboardRes, accountsRes, categoriesRes] = await Promise.all([
  fetch(`/api/dashboard?${params}`),
  fetch('/api/accounts'),
  fetch('/api/categories'),
]);

const [dashboardData, accountsData, categoriesData] = await Promise.all([
  readObjectResponse<DashboardData>(dashboardRes, 'Dashboard data'),
  readArrayResponse<Account>(accountsRes, 'Accounts'),
  readArrayResponse<Category>(categoriesRes, 'Categories'),
]);
```

**Adopted in:** `src/app/page.tsx`, `src/app/categories/page.tsx`, `src/app/subscriptions/page.tsx`, `src/components/categories/CategoryRules.tsx`. **Not yet adopted across older pages** (`src/app/accounts/page.tsx`, `src/app/transactions/page.tsx`, `src/app/statements/page.tsx`) — new fetch code should use these helpers; backfilling old call sites is recommended.

## Error Handling Conventions

**Server-side (API routes):**
- Custom `ValidationError` class in `src/lib/validation.ts` (extends `Error`, sets `this.name = 'ValidationError'`).
- Aggregate field errors into a single comma-joined message before throwing.
- `instanceof ValidationError` check at top of `catch` block to map to 400.
- All other errors -> generic 500 with `console.error` log.

**Client-side:**
- Use `readArrayResponse` / `readObjectResponse` helpers (never inline `.then(r => r.json())`).
- Surface user-facing errors via the toast hook in `src/components/ui/useToast.tsx`.

## Import Organization

**Observed order** (e.g. `src/app/page.tsx` lines 3-23):
1. React / Next built-ins (`react`, `next/...`)
2. Third-party libraries (`lucide-react`, `date-fns`, `recharts`)
3. Internal absolute imports via `@/` alias, grouped roughly:
   - `@/components/ui` (primitives)
   - `@/components/<feature>` (feature components)
   - `@/types` (domain types)
   - `@/lib/...` (utilities & helpers)

**Path aliases:** Only `@/*` -> `./src/*`. No deeper aliases (`@components`, `@lib`, etc.). Prefer absolute `@/` over relative `../../` for cross-directory imports.

## Function & Module Design

**Function size:** Validators in `src/lib/validation.ts` run 20-60 lines each; API handlers run 20-100 lines. Larger logic (CSV parsing, dashboard aggregation) gets its own `src/lib/*.ts` file.

**Exports:**
- Library modules use named exports exclusively (`export function`, `export const`, `export class`).
- Page components use `export default`.
- React feature components use named exports re-exported through barrel `index.ts` files.

**Single-responsibility helpers:** Domain logic split into focused `src/lib/` modules — `categoryDescendants.ts`, `categoryHierarchy.ts`, `categoryIcons.ts`, `searchAmount.ts`, `subscriptionDetector.ts`, `distributionHelpers.ts`. Mirror this pattern for new domain logic instead of accreting onto `utils.ts`.

## Comments

**Style:** Sparse `//` line comments used for intent ("Validate input", "Apply pagination", "Get total count for pagination"). No JSDoc/TSDoc blocks on exported APIs. Adding TSDoc to exported helpers in `src/lib/` would be a low-cost improvement but is not required to match current convention.

## Logging

**Server:** `console.error('Failed to <action>:', error)` — always prefixed with the failing action.

**Client (via `src/lib/http.ts`):** `console.error('<resourceName> request failed', { status, payload })` — structured object payload.

No logger library (Winston, Pino, etc.) is present.

---

*Convention analysis: 2026-05-17*
