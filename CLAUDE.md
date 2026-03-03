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
- **Database**: SQLite (via Prisma)
- **ORM**: Prisma 7.4.2 with LibSQL adapter
- **API Routes**: Next.js App Router API routes
- **File Parsing**: PapaParse (CSV), custom PDF parser
- **AI**: Google Generative AI (Gemini) for categorization

### Alternative Backend
- **Supabase Support**: Dual implementation with Supabase as alternative to SQLite
- Supabase routes available at `/api/supabase/*`
- Can self-host Supabase with Docker (see [SELF_HOSTED.md](SELF_HOSTED.md))

## Architecture

### Directory Structure

```
spending-tracking/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── accounts/           # Accounts management page
│   │   ├── statements/         # Statement upload/management page
│   │   ├── transactions/       # Transaction list/detail page
│   │   ├── settings/           # App settings (Gemini API key)
│   │   ├── api/                # API routes (Prisma/SQLite)
│   │   │   ├── accounts/
│   │   │   ├── categories/
│   │   │   ├── transactions/
│   │   │   ├── statements/
│   │   │   ├── dashboard/
│   │   │   └── supabase/       # Alternative Supabase API routes
│   │   ├── layout.tsx          # Root layout with sidebar
│   │   └── page.tsx            # Dashboard homepage
│   ├── components/             # React components
│   │   ├── ui/                 # Reusable UI components
│   │   ├── accounts/           # Account-specific components
│   │   ├── statements/         # Statement upload components
│   │   ├── transactions/       # Transaction list/filter components
│   │   ├── dashboard/          # Charts and stats components
│   │   └── layout/             # Layout components (Sidebar)
│   ├── lib/                    # Utility libraries
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── supabase.ts        # Supabase client
│   │   ├── csvParser.ts       # CSV statement parser
│   │   ├── pdfParser.ts       # PDF statement parser
│   │   └── utils.ts           # General utilities
│   ├── types/                  # TypeScript type definitions
│   │   └── index.ts           # Shared types (Account, Transaction, etc.)
│   └── generated/prisma/       # Prisma generated client (gitignored)
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Migration history
│   └── dev.db                 # SQLite database file
├── supabase/
│   └── schema.sql             # Supabase SQL schema
├── docker-compose.supabase.yml # Self-hosted Supabase config
├── SUPABASE.md                # Supabase setup guide
├── SELF_HOSTED.md             # Self-hosted Supabase guide
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
   - Fields: month, year, fileName, fileUrl, uploadedAt
   - Relations: account, transactions[]

3. **Category**: Transaction categories (hierarchical)
   - Fields: name, color, icon, parentId
   - Self-referencing: parent, children[]
   - Relations: transactions[]

4. **Transaction**: Individual transactions
   - Types: INCOME, EXPENSE, TRANSFER
   - Fields: amount, description, date, type, isRecurring, notes
   - Relations: account, statement, category
   - Indexed on: accountId+date, categoryId, date

5. **Settings**: Application settings
   - Single record (id: "default")
   - Fields: geminiApiKey

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
- Currently implemented (check file for details)

#### 2. Dashboard Analytics

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

#### 3. Transaction Categorization

**Manual Categorization**:
- Dropdown selector in transaction list
- Updates via PUT `/api/transactions`

**AI Categorization** (Gemini):
- Requires API key in Settings
- Uses Google Generative AI to suggest categories based on description
- Implementation in transaction upload flow

#### 4. Dual Backend Support

**SQLite/Prisma** (Default):
- API routes in `/api/*`
- Database at `prisma/dev.db`
- Prisma client at `src/lib/db.ts`

**Supabase** (Alternative):
- API routes in `/api/supabase/*`
- Client at `src/lib/supabase.ts`
- Schema at `supabase/schema.sql`
- Supports cloud or self-hosted (see [SELF_HOSTED.md](SELF_HOSTED.md))

**Switching Backends**:
```env
# .env
NEXT_PUBLIC_BACKEND=supabase  # or "prisma"
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Then update fetch calls from `/api/*` to `/api/supabase/*`

## Development Workflows

### Getting Started

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations (creates dev.db)
npx prisma migrate dev

# Start dev server
npm run dev
```

### Database Changes

```bash
# 1. Update prisma/schema.prisma

# 2. Create migration
npx prisma migrate dev --name <migration_name>

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
- [prisma/schema.prisma](prisma/schema.prisma) - Database schema definition
- [src/lib/db.ts](src/lib/db.ts) - Prisma client configuration
- [src/types/index.ts](src/types/index.ts) - TypeScript type definitions
- [.gitignore](.gitignore) - Git ignore rules

### Core Logic
- [src/lib/csvParser.ts](src/lib/csvParser.ts) - CSV parsing with flexible format detection
- [src/app/api/dashboard/route.ts](src/app/api/dashboard/route.ts) - Dashboard analytics computation
- [src/components/statements/TimelineUpload.tsx](src/components/statements/TimelineUpload.tsx) - Visual upload interface

### UI Components
- [src/components/ui/](src/components/ui/) - Reusable UI primitives (Card, Button, Input, Modal, Select)
- [src/components/dashboard/Charts.tsx](src/components/dashboard/Charts.tsx) - Chart visualizations
- [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx) - Navigation sidebar

## Environment Variables

```bash
# Optional: Google Gemini API for AI categorization
# Can also be set via Settings page in UI
GEMINI_API_KEY=your-api-key-here

# Optional: Backend selection
NEXT_PUBLIC_BACKEND=prisma  # or "supabase"

# If using Supabase:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Known Limitations & Gotchas

1. **Prisma Client Generation**: The generated Prisma client (`src/generated/prisma/`) is gitignored and must be regenerated after cloning or schema changes via `npx prisma generate`

2. **CSV Format Flexibility**: The CSV parser attempts to handle multiple formats, but unusual bank formats may require parser updates

3. **PDF Parsing**: PDF parsing may be less reliable than CSV depending on bank format

4. **Duplicate Transactions**: Currently no duplicate detection - uploading the same statement twice will create duplicate transactions

5. **Backend Switching**: Switching between Prisma and Supabase requires manual update of fetch URLs in components

6. **Gemini API Costs**: AI categorization uses paid Google Gemini API (though has free tier)

7. **SQLite Concurrency**: SQLite has limited concurrent write support - may need PostgreSQL for production

## Common Tasks

### Add a New Category
```bash
# Via Prisma Studio
npx prisma studio

# Or via seed route
POST /api/categories/seed
```

### Reset Database
```bash
# Delete and recreate
rm prisma/dev.db
npx prisma migrate dev
```

### Export Data
```bash
# Via Prisma Studio or custom export route
npx prisma studio
```

### Self-Host with Supabase
See [SELF_HOSTED.md](SELF_HOSTED.md) for Docker Compose setup

## Future Enhancements

Potential areas for improvement:
- Duplicate transaction detection
- Recurring transaction templates
- Budget tracking and alerts
- Multi-user support with authentication
- Mobile-responsive improvements
- Export/import functionality
- Bank API integrations (Plaid, etc.)
- Scheduled email reports
- Advanced filtering/search
- Custom category hierarchies
- Receipt attachment storage

## Debugging Tips

1. **Prisma Issues**: Check `prisma/dev.db` exists, run `npx prisma generate`
2. **API Errors**: Check browser console and terminal logs
3. **CSV Parsing**: Log parsed results in `csvParser.ts` to debug field mapping
4. **Database Inspection**: Use `npx prisma studio` to view/edit data directly
5. **Type Errors**: Ensure Prisma client is regenerated after schema changes

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Recharts](https://recharts.org/)

---

**Last Updated**: 2026-03-02
**Project Status**: Active Development
**Primary Language**: TypeScript
