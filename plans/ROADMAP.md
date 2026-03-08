# Xpend - Product Roadmap

> **Last Updated**: March 8, 2026
> **Status**: Active Development

## 🎯 Vision

Transform Xpend into a comprehensive personal finance management platform with intelligent insights, beautiful UX, and powerful automation capabilities.

---

## 📅 Q1 2026 - Foundation & Polish

### ✅ Completed (v0.1-v0.3)
- [x] Core transaction management
- [x] Multi-account support
- [x] Category hierarchy with subcategories
- [x] CSV/PDF statement upload
- [x] Basic dashboard with charts
- [x] Reports & analytics page
- [x] Dual-select navigation for distribution carousel
- [x] Sensitive values toggle
- [x] Monthly/daily granularity for trends

### 🚧 In Progress (v0.4)
- [ ] Fix remaining UI polish issues
- [ ] Optimize chart performance
- [ ] Mobile responsive improvements

### 📋 Q1 Backlog
- [ ] Add loading states to all async operations
- [ ] Implement error boundaries
- [ ] Add toast notifications system
- [ ] Improve CSV parser error handling
- [ ] Add transaction bulk operations (select multiple → categorize)

---

## 🎨 Q2 2026 - UX Enhancement Phase

### Priority 1: Visual & Interaction Improvements
- [ ] **Dark Mode Implementation**
  - Theme toggle in sidebar
  - Persist preference in localStorage
  - Update all components for dark theme
  - Smooth transition animations
  - **Effort**: 2-3 days
  - **Impact**: High user satisfaction

- [ ] **Chart Animations & Interactions**
  - Add Framer Motion for smooth transitions
  - Drill-down functionality (click category → filter transactions)
  - Hover states with detailed tooltips
  - Loading skeletons for charts
  - **Effort**: 3-4 days
  - **Impact**: Premium feel

- [ ] **Keyboard Shortcuts**
  - ⌘K / Ctrl+K for global search
  - ⌘N for new transaction
  - Arrow keys for navigation
  - ESC to close modals
  - Display shortcuts modal (⌘?)
  - **Effort**: 2 days
  - **Impact**: Power user efficiency

### Priority 2: Navigation Improvements
- [ ] **Collapsible Sidebar**
  - Minimize/expand functionality
  - Icons-only mode
  - Persist state
  - **Effort**: 1 day
  - **Impact**: More screen space

- [ ] **Breadcrumbs**
  - Category hierarchy navigation
  - Statement → Account navigation
  - Quick back navigation
  - **Effort**: 1 day
  - **Impact**: Better orientation

- [ ] **Saved Filter Presets**
  - Save custom filter combinations
  - Quick access dropdown
  - Edit/delete presets
  - **Effort**: 2-3 days
  - **Impact**: Time saving for repeated queries

---

## 🔧 Q3 2026 - Smart Features Phase

### Priority 1: Intelligent Categorization
- [ ] **Enhanced Auto-categorization**
  - Improve Gemini AI prompts
  - Add local ML model (TensorFlow.js) as fallback
  - Learn from user corrections
  - Confidence scores
  - **Effort**: 1 week
  - **Impact**: Massive time saving

- [ ] **Custom Categorization Rules**
  - If description contains X → Category Y
  - Rule priority system
  - Test rules before applying
  - Import/export rules
  - **Effort**: 4-5 days
  - **Impact**: Automation

- [ ] **Duplicate Detection**
  - Fuzzy matching algorithm
  - Visual diff viewer
  - Merge or keep both options
  - Auto-detect on upload
  - **Effort**: 3-4 days
  - **Impact**: Data quality

### Priority 2: Transaction Enhancements
- [ ] **Split Transactions**
  - Divide amount across multiple categories
  - Percentage or fixed amount splits
  - Visual split editor
  - **Effort**: 3-4 days
  - **Impact**: Accuracy for mixed purchases

- [ ] **Recurring Transactions**
  - Template system
  - Auto-create on schedule
  - Variation detection (amount changes)
  - Subscription tracking
  - **Effort**: 5-6 days
  - **Impact**: Budget planning

- [ ] **Attachments & Receipts**
  - Upload PDF/image per transaction
  - Thumbnail preview
  - Download/view modal
  - OCR for receipt data extraction (future)
  - **Effort**: 3-4 days
  - **Impact**: Record keeping

### Priority 3: Budgets & Goals
- [ ] **Budget Tracking**
  - Set monthly budgets per category
  - Visual progress bars
  - Overspending alerts
  - Rollover unused budget
  - **Effort**: 1 week
  - **Impact**: Financial discipline

- [ ] **Savings Goals**
  - Target amount and date
  - Track contributions
  - Visual progress
  - Goal categories (vacation, emergency fund, etc.)
  - **Effort**: 4-5 days
  - **Impact**: Motivation

---

## 🔐 Q4 2026 - Multi-user & Security Phase

### Priority 1: Authentication System
- [ ] **User Authentication**
  - Implement NextAuth.js or Clerk
  - Email/password login
  - OAuth (Google, GitHub)
  - Password reset flow
  - Email verification
  - **Effort**: 1 week
  - **Impact**: Production readiness

- [ ] **Multi-user Support**
  - User model in database
  - Scope all queries by userId
  - User settings
  - Profile management
  - **Effort**: 1 week
  - **Impact**: Real-world usage

### Priority 2: Collaboration Features
- [ ] **Shared Workspaces**
  - Family/household accounts
  - Invite members via email
  - Permission levels (viewer, editor, admin)
  - Separate personal vs shared accounts
  - **Effort**: 1.5 weeks
  - **Impact**: Family finance management

- [ ] **Activity Log**
  - Track all changes
  - Who did what when
  - Audit trail
  - Undo recent actions
  - **Effort**: 3-4 days
  - **Impact**: Transparency & safety

### Priority 3: Data Security
- [ ] **Data Encryption**
  - Encrypt sensitive fields at rest
  - End-to-end encryption option
  - Secure key management
  - **Effort**: 1 week
  - **Impact**: Trust & compliance

- [ ] **GDPR Compliance**
  - Data export (JSON/CSV)
  - Account deletion
  - Privacy policy
  - Cookie consent
  - **Effort**: 4-5 days
  - **Impact**: Legal compliance

---

## 📊 2027 - Advanced Analytics & Integrations

### Q1 2027: Reporting & Export
- [ ] **Advanced Reports**
  - Custom report builder
  - Scheduled email reports
  - PDF export with charts
  - Excel export with formulas
  - **Effort**: 2 weeks
  - **Impact**: Professional use cases

- [ ] **Comparison Tools**
  - Period over period (MoM, YoY)
  - Account comparisons
  - Category benchmarking
  - **Effort**: 1 week
  - **Impact**: Trend analysis

### Q2 2027: AI Insights
- [ ] **Smart Alerts**
  - Unusual spending detection
  - Budget warning notifications
  - Upcoming bill reminders
  - Cash flow predictions
  - **Effort**: 2 weeks
  - **Impact**: Proactive management

- [ ] **Financial Advisor AI**
  - Personalized saving tips
  - Spending pattern analysis
  - Optimization recommendations
  - Subscription waste detection
  - **Effort**: 3 weeks
  - **Impact**: Value-add differentiation

### Q3 2027: Integrations
- [ ] **Bank Integrations**
  - Plaid integration for US
  - Open Banking for EU/UK
  - Auto-sync transactions
  - Balance tracking
  - **Effort**: 3-4 weeks
  - **Impact**: Automation

- [ ] **Third-party Exports**
  - QuickBooks export
  - YNAB import/export
  - Mint migration tool
  - **Effort**: 2 weeks
  - **Impact**: Ecosystem play

### Q4 2027: Mobile & Offline
- [ ] **Mobile App**
  - React Native or PWA
  - Native feel
  - Biometric auth
  - Receipt scanner with OCR
  - Offline mode
  - **Effort**: 6-8 weeks
  - **Impact**: On-the-go tracking

---

## 🛠️ Technical Debt & Infrastructure

### Database Migration (Q2 2026)
- [ ] Migrate from SQLite to PostgreSQL
- [ ] Set up connection pooling
- [ ] Optimize indexes
- [ ] Implement query caching
- **Effort**: 1 week
- **Impact**: Scalability

### Testing Infrastructure (Q3 2026)
- [ ] Unit tests with Vitest (80% coverage target)
- [ ] Integration tests for API routes
- [ ] E2E tests with Playwright
- [ ] Visual regression tests
- [ ] CI/CD pipeline with GitHub Actions
- **Effort**: 2-3 weeks
- **Impact**: Quality & confidence

### Performance Optimization (Ongoing)
- [ ] Implement virtual scrolling for long lists
- [ ] Lazy load charts and images
- [ ] Add service worker for offline
- [ ] Optimize bundle size (code splitting)
- [ ] Add performance monitoring (Sentry)
- **Effort**: 1-2 weeks
- **Impact**: Speed & UX

---

## 📈 Success Metrics

### User Experience
- [ ] Page load time < 2s (p95)
- [ ] Time to first paint < 1s
- [ ] Zero critical accessibility issues (WCAG AA)
- [ ] Mobile responsiveness score > 95

### Product Usage
- [ ] Average transactions per user > 50/month
- [ ] Daily active users growth rate
- [ ] Feature adoption rate > 60% for key features
- [ ] Retention rate (7-day, 30-day)

### Technical Health
- [ ] Test coverage > 80%
- [ ] Zero production errors
- [ ] API response time < 500ms (p95)
- [ ] Uptime > 99.9%

---

## 🎯 Immediate Next Steps (This Week)

1. **Commit recent UI improvements**
   - Distribution carousel enhancements
   - Tooltip removal
   - Monthly granularity for expense trends

2. **Fix critical bugs** (if any reported)

3. **Choose next feature from Q2 roadmap**
   - **Recommendation**: Start with Dark Mode (high impact, visible improvement)
   - Alternative: Budget Tracking (high user value)

4. **Set up basic testing**
   - Add Vitest
   - Write first unit tests
   - Set up CI pipeline

---

## 💡 Feature Requests Backlog

Track user-requested features here:

- [ ] Multi-currency support
- [ ] Investment tracking
- [ ] Tax category tagging
- [ ] Bill payment reminders
- [ ] Cash flow forecasting
- [ ] Merchant favorites/blocklist
- [ ] Custom date ranges (not just presets)
- [ ] Bulk transaction editing
- [ ] Account reconciliation
- [ ] Import from other apps (Mint, YNAB)

---

## 📝 Notes

- Prioritization based on: **Impact × Feasibility / Effort**
- User feedback will influence roadmap adjustments
- Each quarter should ship at least one "wow" feature
- Maintain backwards compatibility unless major version bump
- Keep docs updated as features ship

---

## 🚀 How to Contribute

1. Pick an item from the roadmap
2. Create a feature branch: `feature/budget-tracking`
3. Implement with tests
4. Submit PR with screenshots/demo
5. Update this roadmap when shipped

---

**Questions or suggestions?** Open an issue or discuss in team meetings.
