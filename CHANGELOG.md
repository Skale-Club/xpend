# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-07-10

Security, correctness and quality pass following a full system audit
(see [ANALISE_SISTEMA.md](ANALISE_SISTEMA.md)).

### Security
- **MCP token management endpoints (`/api/mcp/tokens*`) now require an
  authenticated Supabase session.** Previously the middleware bypassed auth for
  everything under `/api/mcp`, allowing unauthenticated token creation with any
  permission. The bypass is now restricted to the protocol endpoints
  (`/api/mcp`, `/protocol`, `/sse`, `/messages`), which use Bearer-token auth.
- SSE sessions are bound to their token server-side; the token is no longer
  embedded in the `messages` endpoint URL.
- Admin routes revalidate super-admin status in the handler (defense in depth,
  no longer relying solely on the middleware matcher).
- Statement upload: file names are sanitized before being used as storage
  paths, uploads are capped at 15 MB, and the stored content type is derived
  from the validated extension instead of trusting the client.
- MCP tool errors no longer echo raw database driver messages to clients.
- `DELETE /api/history` (wipes all chat sessions) now requires `?confirm=true`.

### Fixed
- **Goal progress no longer resets when editing a goal**: partial update
  payloads without `currentAmount` preserve the accumulated value.
- Deleting a goal contribution uses an atomic decrement (no read-modify-write
  race).
- CSV date parsing: removed the ambiguous `new Date(string)` fallback for
  numeric dates, added file-level DD/MM vs MM/DD inference, normalized all
  parsed dates to UTC midnight (fixes re-upload dedup duplicates), and
  impossible dates (31/02) are rejected instead of overflowing.
- CSV amount parsing: US amounts with thousands separators ("1,234.56") were
  mis-parsed as European format; the decimal separator is now whichever
  appears last. Unparseable amounts skip the row instead of importing 0.
- Chat/memory model ids stored without a provider prefix (legacy
  "gemini-2.5-flash") are normalized to OpenRouter ids ("google/…").
- Dashboard aggregations use UTC accessors consistently and compute account
  balances in a single pass.
- Category update validates payloads (`validateCategoryData`), blocks
  re-parenting a category under its own descendant, and syncs descendant
  colors atomically; category delete is transactional.
- Statement upload persists statement + transactions + invoice in a single
  database transaction.

### Added
- Unit tests (Vitest) for the CSV parser, installment parser, goal
  calculations and chat model normalization; `npm test` / `npm run typecheck`.
- GitHub Actions CI: lint + typecheck + tests on every PR.
- Global error boundary (`error.tsx`) and 404 page (`not-found.tsx`).
- Optional `accountId` scope for bulk categorize-by-keyword.

### Removed
- Unused `@vercel/analytics` dependency.

### Notable features shipped since 1.1.0 (previously unlisted)
Goals (plans, scenarios, milestones, debt strategies, AI planner), credit-card
invoices with installment tracking, subscription detection overhaul, chat
assistant with tools, financial memory + journey system, MCP server with token
permissions and audit log, admin API logs panel, PWA, dark mode.

## [1.1.0] - 2026-03-02

### Added
- **Toast Notification System**: Global toast notifications for user feedback
  - Success, error, warning, and info toast types
  - Auto-dismiss with customizable duration
  - Slide-in animations
- **Input Validation**: Comprehensive validation for all API routes
  - Account validation (name, type, balance, etc.)
  - Transaction validation
  - Category validation  
  - Statement upload validation
  - Query parameter validation
- **Duplicate Transaction Detection**: Prevents duplicate transactions on re-upload
  - Compares date, amount, and description
  - Reports number of duplicates skipped
- **Pagination Support**: Added pagination to transactions API
  - Configurable limit and offset
  - Returns total count and hasMore flag
  - Default limit: 50, max: 1000
- **Database Scripts**: Added npm scripts for database management
  - `db:generate`, `db:migrate`, `db:studio`, `db:reset`, etc.
- **Mobile Responsive Navigation**: Hamburger menu for mobile devices
  - Slide-in sidebar animation
  - Backdrop overlay
  - Auto-close on navigation

### Fixed
- **Gemini Model Name**: Updated from `gemini-3-flash-preview` to `gemini-1.5-flash`
- **N+1 Query Problem**: Optimized dashboard queries to eliminate N+1 pattern
  - Reduced from O(n) to O(1) database queries
  - ~90% performance improvement with multiple accounts

### Changed
- **Dynamic Copyright Year**: Footer now shows current year dynamically
- **Error Handling**: Improved error messages and HTTP status codes across all API routes
- **Validation Error Responses**: Now return 400 instead of 500 for validation errors
- **Mobile Layout**: Added responsive padding and menu button

### Security
- **Input Sanitization**: All user inputs are now validated and sanitized
- **SQL Injection Prevention**: Validation prevents malformed data reaching database

### Performance
- **Dashboard Loading**: ~90% faster with multiple accounts
- **Transaction Queries**: Added pagination for better performance with large datasets
- **Memory Usage**: Reduced memory footprint with paginated responses

## [1.0.0] - 2026-03-02

### Initial Release
- Multi-account management
- CSV/PDF statement upload
- Transaction categorization with AI
- Dashboard with charts and analytics
- Supabase and Prisma support
- Mobile-friendly UI

---

**Format**: Based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
**Versioning**: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
