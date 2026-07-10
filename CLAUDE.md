# Spending Tracker - Project Documentation

> **Purpose**: Personal finance tracking application for managing accounts, statements, and transactions with AI-powered categorization.

## Project Overview

A Next.js-based spending tracker that allows users to:
- Manage multiple financial accounts (checking, savings, credit cards, etc.)
- Upload bank statements (CSV/PDF) with automatic transaction parsing
- Track income and expenses across time periods
- Visualize spending patterns with charts and analytics
- Categorize transactions automatically using Google Gemini AI
- View monthly trends and balance history

## Tech Stack

### Frontend
- **Framework**: Next.js 16.1.6 (React 19.2.3)
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts 3.7.0
- **Icons**: Lucide React
- **Date Handling**: date-fns 4.1.0

### Backend
- **Database**: PostgreSQL via Supabase (cloud-hosted)
- **ORM**: Prisma 7.4.2 with `@prisma/adapter-pg` (PrismaPg adapter)
- **API Routes**: Next.js App Router API routes
- **File Parsing**: PapaParse (CSV), custom PDF parser
- **AI**: OpenRouter via Vercel AI SDK (default model `google/gemini-2.5-flash`) — chat, categorization, PDF extraction, memory extraction. Note: legacy column/variable names still say "gemini" (`geminiApiKey`, `geminiChatModel`) but the key stored is an OpenRouter key (ids normalized by `normalizeChatModel`).

### Supabase Services Used
- **Auth**: Supabase Auth (email/password) — enforced via middleware on all `/api/*` routes
- **Storage**: Supabase Storage (`statements` bucket, private) — bank statement files
- **Database**: Supabase-hosted PostgreSQL accessed directly via Prisma (not via Supabase JS client)

> Note: There is no `/api/supabase/*` route directory. Supabase is not used as a query layer — Prisma handles all DB queries.

## Architecture

### Directory Structure

```
xpend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── accounts/           # Accounts management page
│   │   ├── statements/         # Statement upload/management page
│   │   ├── transactions/       # Transaction list/detail page
│   │   ├── reports/            # Analytics and reporting page
│   │   ├── subscriptions/      # Subscription detection page
│   │   ├── settings/           # App settings (Gemini API key, model)
│   │   ├── api/                # API routes (all backed by Prisma/PostgreSQL)
│   │   │   ├── accounts/
│   │   │   ├── categories/
│   │   │   ├── transactions/
│   │   │   ├── statements/
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── signed-url/  # GET: returns 7-day signed URL for private file
│   │   │   │   │   └── categorize/
│   │   │   │   └── upload/
│   │   │   ├── dashboard/
│   │   │   ├── reports/
│   │   │   ├── subscriptions/
│   │   │   └── chat/
│   │   ├── layout.tsx          # Root layout with sidebar + AuthGate
│   │   └── page.tsx            # Dashboard homepage
│   ├── components/             # React components
│   │   ├── ui/                 # Reusable UI components
│   │   ├── accounts/           # Account-specific components
│   │   ├── statements/         # Statement upload components
│   │   ├── transactions/       # Transaction list/filter components
│   │   ├── dashboard/          # Charts and stats components
│   │   ├── categories/         # Category management components
│   │   └── layout/             # Layout components (Sidebar)
│   ├── lib/                    # Utility libraries
│   │   ├── db.ts              # Prisma client singleton (PrismaPg adapter)
│   │   ├── supabaseBrowser.ts # Supabase browser client (Auth only)
│   │   ├── csvParser.ts       # CSV statement parser
│   │   ├── pdfParser.ts       # PDF statement parser
│   │   ├── autoCategorize.ts  # AI + rule-based categorization
│   │   ├── subscriptionDetector.ts # Automatic subscription detection
│   │   └── utils.ts           # General utilities
│   ├── types/                  # TypeScript type definitions
│   │   └── index.ts           # Shared types (Account, Transaction, etc.)
│   └── generated/prisma/       # Prisma generated client (gitignored)
├── prisma/
│   ├── schema.prisma          # Database schema (PostgreSQL)
│   └── migrations/            # Migration history
├── public/
│   └── sw.js                  # PWA service worker
└── README.md                  # Getting started
```

### Database Schema

**Core Models** (see [prisma/schema.prisma](prisma/schema.prisma)):

1. **Account**: Bank accounts/cards
   - Types: CHECKING, SAVINGS, CREDIT_CARD, DEBIT_CARD, CASH, OTHER
   - Fields: name, type, bank, color, icon, initialBalance, isActive
   - Relations: statements[], transactions[]

2. **Statement**: Monthly statement files
   - Unique by accountId + month + year
   - Fields: month, year, fileName, fileUrl (storage path), uploadedAt
   - Relations: account, transactions[]

3. **Category**: Transaction categories (hierarchical)
   - Fields: name, color, icon, parentId, budget, isSystem
   - Self-referencing: parent, children[]
   - Relations: transactions[], categorizationRules[]

4. **Transaction**: Individual transactions
   - Types: INCOME, EXPENSE, TRANSFER
   - Fields: amount, description, date, type, isRecurring, notes
   - Relations: account, statement, category
   - Indexed on: accountId+date, categoryId, date

5. **Settings**: Application settings
   - Single record (id: "default")
   - Fields: geminiApiKey, geminiChatModel

6. **Subscription**: Detected recurring charges
   - Fields: name, price, billingCycle, avgAmount, occurrences, source, inactive

7. **CategorizationRule**: Rules for auto-categorization
   - Fields: keywords, matchType, priority, isActive

### Key Features Implementation

#### 1. Statement Upload & Parsing

**Timeline Upload Component** ([src/components/statements/TimelineUpload.tsx](src/components/statements/TimelineUpload.tsx)):
- Visual month-by-month upload interface
- Status tracking: idle, uploading, success, error, incomplete
- Highlights current month
- Shows missing statements for past months

**CSV Parser** ([src/lib/csvParser.ts](src/lib/csvParser.ts)):
- Flexible field detection (supports multiple languages/formats)
- Date parsing: DD/MM/YYYY, MM/DD/YYYY, ISO
- Amount parsing: handles currency symbols, comma/period decimals, negative formats
- Transaction type detection: debit/credit columns or signed amounts
- Field mapping supports: English, Portuguese, Spanish headers

**PDF Parser** ([src/lib/pdfParser.ts](src/lib/pdfParser.ts)):
- Uses Google Gemini AI to extract transactions from PDF bank statements

**Re-upload behavior**: Re-uploading a statement for the same month merges new rows rather than deleting existing ones. Transactions already in the DB (matched by date + amount + description) are preserved with their user edits (categoryId, notes, isRecurring).

#### 2. Statement File Storage

Files are uploaded to Supabase Storage (`statements` bucket, **private**). The `fileUrl` column stores the storage path (not a public URL). To download a file, call:

```
GET /api/statements/{id}/signed-url
```

This returns a 7-day signed URL issued server-side with the service role key.

#### 3. Dashboard Analytics

**Route**: [src/app/api/dashboard/route.ts](src/app/api/dashboard/route.ts)

**Features**:
- Total income/expenses/balance calculation
- Monthly trend analysis (income vs expenses)
- Category breakdown (expense distribution)
- Balance trend over time
- Recent transactions list (limited to 50)
- Filtering by: date range, accounts, categories, transaction type, amount range, search query

**Chart Components**:
- `MonthlyChart`: Bar chart showing income/expenses by month
- `CategoryPieChart`: Pie chart of expense categories
- `BalanceTrendChart`: Line chart of running balance
- `StatsCards`: Summary cards for key metrics

#### 4. Transaction Categorization

**Manual Categorization**:
- Dropdown selector in transaction list
- Updates via PUT `/api/transactions`

**Rule-based Categorization**:
- Keyword rules stored in `CategorizationRule` table
- Managed via Settings > Categorization Rules UI

**AI Categorization** (Gemini):
- Requires API key in Settings
- Uses model from `Settings.geminiChatModel` (default: `gemini-2.5-flash`)
- Called via `suggestByAI` in `src/lib/autoCategorize.ts`

**Bulk categorization** trains rules from all distinct descriptions in the selected batch.

#### 5. Subscription Detection

Runs automatically after each statement upload. Minimum 3 occurrences required to classify a pattern as a subscription (`MIN_OCCURRENCES = 3` in `subscriptionDetector.ts`).

#### 6. Authentication

- Supabase Auth (email/password)
- Middleware at `middleware.ts` protects all `/api/*` routes
- Exception: the MCP **protocol** endpoints (`/api/mcp`, `/api/mcp/protocol`, `/api/mcp/sse`, `/api/mcp/messages`) bypass the session check and use their own Bearer-token auth. MCP token **management** (`/api/mcp/tokens*`) requires a session, revalidated in the handler via `requireSession` (`src/lib/auth/requireSession.ts`)
- Client-side `AuthGate.tsx` wraps the app UI
- No multi-tenant row-level isolation yet (single-user app)

## Development Workflows

### Getting Started

```bash
# Install dependencies
npm install

# Generate Prisma client (required after clone or schema changes)
npx prisma generate

# Start dev server (port 6112)
npm run dev
```

### Quality Checks

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest unit tests (csvParser, installment, goals, chat models)
```

CI (`.github/workflows/ci.yml`) runs all three on every PR.

### Database Changes

```bash
# 1. Update prisma/schema.prisma

# 2. Create and apply migration
npm run db:migrate
# (runs: prisma migrate dev --name <migration_name>)

# 3. Regenerate client
npx prisma generate
```

### Adding a New Feature

1. **Add API Route**: Create route handler in `src/app/api/<feature>/route.ts`
2. **Add Types**: Update `src/types/index.ts`
3. **Add Component**: Create component in `src/components/<feature>/`
4. **Add Page** (if needed): Create page in `src/app/<feature>/page.tsx`
5. **Update Sidebar**: Add navigation link in `src/components/layout/Sidebar.tsx`

### Common Patterns

**API Route Pattern**:
```typescript
// src/app/api/<resource>/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const data = await prisma.<model>.findMany();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
```

**Client Component Pattern**:
```typescript
'use client';

import { useEffect, useState } from 'react';

export default function Component() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/resource')
      .then(res => res.json())
      .then(setData);
  }, []);

  return <div>...</div>;
}
```

## Key Files Reference

### Critical Configuration
- [prisma/schema.prisma](prisma/schema.prisma) - Database schema definition (PostgreSQL)
- [src/lib/db.ts](src/lib/db.ts) - Prisma client with PrismaPg adapter
- [src/types/index.ts](src/types/index.ts) - TypeScript type definitions
- [middleware.ts](middleware.ts) - Auth middleware (protects /api/*)
- [.gitignore](.gitignore) - Git ignore rules

### Core Logic
- [src/lib/csvParser.ts](src/lib/csvParser.ts) - CSV parsing with flexible format detection
- [src/lib/autoCategorize.ts](src/lib/autoCategorize.ts) - Rule + AI categorization
- [src/lib/subscriptionDetector.ts](src/lib/subscriptionDetector.ts) - Subscription detection (MIN_OCCURRENCES=3)
- [src/app/api/dashboard/route.ts](src/app/api/dashboard/route.ts) - Dashboard analytics computation
- [src/components/statements/TimelineUpload.tsx](src/components/statements/TimelineUpload.tsx) - Visual upload interface

### UI Components
- [src/components/ui/](src/components/ui/) - Reusable UI primitives (Card, Button, Input, Modal, Select)
- [src/components/dashboard/Charts.tsx](src/components/dashboard/Charts.tsx) - Chart visualizations
- [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx) - Navigation sidebar

## Environment Variables

```bash
# Required: Supabase PostgreSQL connection string
DATABASE_URL=postgresql://...

# Required: Supabase project URL and anon key (Auth + Storage client-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Required for statement storage: service role key (used server-side only)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Google Gemini API for AI categorization
# Can also be set via Settings page in UI
GEMINI_API_KEY=your-api-key-here
```

## Known Limitations & Gotchas

1. **Prisma Client Generation**: The generated Prisma client (`src/generated/prisma/`) is gitignored and must be regenerated after cloning or schema changes via `npx prisma generate`

2. **CSV Format Flexibility**: The CSV parser attempts to handle multiple formats, but unusual bank formats may require parser updates

3. **PDF Parsing**: PDF parsing may be less reliable than CSV depending on bank format

4. **Transaction Dedup**: Transaction dedup matches on exact `(date, amount, description)`. Bank descriptions sometimes vary (truncation, suffix codes) which can slip through dedup and create near-duplicates.

5. **Gemini API Costs**: AI categorization uses paid Google Gemini API (though has free tier)

6. **No Multi-tenant Isolation**: All DB rows are shared across any Supabase Auth users. Currently single-user only. A second account could read/modify all data.

7. **Float amounts**: Transaction amounts are stored as PostgreSQL `Float`. No precision loss observed in current data, but large transaction sets could drift.

## Common Tasks

### Add a New Category
```bash
# Via Prisma Studio
npx prisma studio

# Or via seed route
POST /api/categories/seed
```

### Inspect the Database
```bash
npx prisma studio
```

### Reset Database (Development)
```bash
# Drop and recreate via Supabase dashboard, then re-run migrations
npm run db:migrate
```

## Future Enhancements

Potential areas for improvement:
- Multi-user support with per-user row isolation (userId on all models, RLS policies)
- Duplicate transaction detection using normalized descriptions
- Recurring transaction templates
- Budget tracking and alerts
- Mobile-responsive improvements
- Export/import functionality
- Bank API integrations (Plaid, etc.)
- Scheduled email reports
- Advanced filtering/search
- Receipt attachment storage
- Automated tests (Vitest) for csvParser, subscriptionDetector, dashboard aggregation

## Debugging Tips

1. **Prisma Issues**: Run `npx prisma generate` after any schema change
2. **API Errors**: Check browser console and Vercel/terminal logs
3. **CSV Parsing**: Log parsed results in `csvParser.ts` to debug field mapping
4. **Database Inspection**: Use `npx prisma studio` to view/edit data directly
5. **Type Errors**: Ensure Prisma client is regenerated after schema changes
6. **Auth Issues**: Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in env
7. **Storage Issues**: Check `SUPABASE_SERVICE_ROLE_KEY` — required for signed URL generation and uploads

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Recharts](https://recharts.org/)

---

**Last Updated**: 2026-07-10
**Project Status**: Active Development
**Primary Language**: TypeScript
