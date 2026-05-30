import { prisma } from '@/lib/db';
import type { BillingCycle } from '@/generated/prisma';

export interface DetectedPattern {
  normalizedDescription: string; // canonical merchant key (stored as matchPattern)
  displayName: string;
  billingCycle: BillingCycle;
  frequency: number;
  avgAmount: number;
  dates: Date[];
  firstSeen: Date;
  lastSeen: Date;
  occurrences: number;
  intervalDays: number;
  accountId: string;
  categoryId: string | null;
}

export interface DetectionResult {
  detected: number;
  created: number;
  updated: number;
  markedInactive: number;
  deletedOrphans: number;
}

const MIN_OCCURRENCES = 3;
const MIN_DISTINCT_MONTHS = 3; // must recur across at least 3 calendar months (monthly/yearly)
const MIN_SPAN_DAYS_SHORT = 21; // for weekly/daily cadence, must span at least this long
const MIN_AMOUNT = 1.0; // ignore sub-$1 lines (FX fee fragments, rounding noise)
const INACTIVE_MULTIPLIER = 1.5; // > 1.5x billing cycle without a charge = inactive
const USAGE_CHARGES_PER_MONTH = 1.6; // > this avg charges/month => usage-style billing
const AMOUNT_REGULARITY_TOLERANCE = 0.2; // a value is "regular" if within 20% of median
const AMOUNT_REGULARITY_FRACTION = 0.7; // 70% of values must be regular (non-allowlisted)

/**
 * Merchant types that are never subscriptions, matched as substrings against the
 * normalized description. Catches transfers, BNPL, fuel, fast food and bank fees that
 * the amount/interval heuristics would otherwise mistake for recurring plans.
 */
const BLOCKLIST_SUBSTRINGS = [
  // Transfers / P2P / money movement
  'zelle', 'venmo', 'cashapp', 'cash app', 'wire transfer', 'ach transfer', 'online transfer',
  'paypal xfer', 'paypal transfer', 'wise inc', 'wise us', 'wise (us', 'alipay',
  // Buy-now-pay-later installments
  'payin4', 'pay in 4', 'afterpay', 'klarna', 'affirm', 'sezzle', 'quadpay', 'zip co',
  // Fuel / convenience stores
  'exxon', 'mobil', 'speedway', 'nouria', 'cumberland farms', 'gulf oil', 'chevron', 'sunoco',
  'citgo', 'marathon petro', 'valero', 'phillips 66', 'circle k', 'wawa', 'sheetz', 'racetrac',
  'quiktrip', '7-eleven', 'holliston', 'shell',
  // Bank fees / cash / ATM
  'maintenance fee', 'overdraft', 'service charge', 'service fee', 'atm fee', 'late fee',
  'interest charge', 'cash withdrawal', 'atm withdrawal', 'atm withdrwl', 'withdrwl',
  'foreign transaction', 'international transaction fee',
  // Tolls / parking
  'e-zpass', 'ezpass', 'parkwhiz', 'boston parking',
  // Advertising spend (variable, not a subscription plan)
  'google ads', 'facebook ads', 'meta platforms',
  // Big-box retail / not a subscription
  'amzn mktp', 'amazon mktp', 'walmart', 'wal-mart', 'wal mart', 'wm supercenter',
  'laundromat', 'laundry',
];

/** Canonical merchants that are exact-match blocked (e.g. bare Amazon shopping vs Amazon Prime). */
const BLOCKLIST_EXACT = new Set(['amazon', 'amazon.com']);

/**
 * Category names (lowercased) that are definitionally not subscriptions. Leverages the
 * user's existing categorization to drop fuel, food, transfers, rent, etc.
 */
const EXCLUDED_CATEGORY_NAMES = new Set([
  'food & dining', 'fast food', 'restaurants', 'groceries',
  'gas & fuel', 'public transit', 'car maintenance', 'car loan payment',
  'transfer', 'internal transfer', 'international transfer', 'credit card payment', 'savings',
  'rent', 'rent/mortgage',
]);

/**
 * Known SaaS / subscription merchants (substring on canonical name). These are accepted on
 * recurrence alone (no amount-consistency gate) because usage-based billing legitimately
 * varies month to month.
 */
const SUBSCRIPTION_ALLOWLIST = [
  'anthropic', 'claude', 'openai', 'chatgpt', 'highlevel', 'gohighlevel', 'vercel', 'hetzner',
  'hostinger', 'netflix', 'spotify', 'google one', 'youtube', 'midjourney', 'adobe', 'microsoft',
  'apple', 'amazon prime', 'disney', 'hulu', 'dropbox', 'github', 'notion', 'figma', 'canva',
  'slack', 'zoom', 'linkedin', 'elevenlabs', 'cursor', 'replit', 'digitalocean', 'cloudflare',
  'namecheap', 'godaddy', 'splice', 'audible', 'patreon', 'substack', 'icloud', 'f1',
  // Usage-based / dev & marketing SaaS evident in the user's data
  'twilio', 'vapi', 'apify', 'smartlead', 'instantly', 'neverbounce', 'autocut', 'oculus',
];

/** Pretty display names for canonical merchants that don't title-case nicely. */
const DISPLAY_NAMES: Record<string, string> = {
  'google one': 'Google One',
  anthropic: 'Anthropic (Claude)',
  'openai chatgpt': 'OpenAI ChatGPT',
  'openai api': 'OpenAI API',
  'highlevel agency': 'HighLevel Agency',
  highlevel: 'HighLevel',
  midjourney: 'Midjourney',
  spotify: 'Spotify',
  'amazon prime': 'Amazon Prime',
  splice: 'Splice',
  'f1 tv': 'F1 TV',
  elevenlabs: 'ElevenLabs',
  godaddy: 'GoDaddy',
  github: 'GitHub',
  digitalocean: 'DigitalOcean',
  autocut: 'AutoCut',
};

/**
 * Normalize a transaction description for grouping.
 * Strips bank-specific noise (reference IDs, dates, locations, domains, transaction prefixes)
 * to group the same merchant across different transactions.
 */
export function normalizeDescription(desc: string): string {
  let n = desc.toLowerCase().trim();

  // Common US bank transaction prefixes
  n = n.replace(/^(checkcard|mobile purchase|purchase|debit card|pos|ach|recurring|preauthorized)\s+/i, '');
  // 4-digit MMDD date prefix (e.g. "0221 ")
  n = n.replace(/^\d{4}\s+/, '');
  // Inline dates like 02/24, 01-06, 02/24/2026
  n = n.replace(/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/g, '');
  // #-prefixed reference numbers
  n = n.replace(/#\d+/g, '');
  // *-prefixed IDs (e.g. *A916D7UN3, *CHATGPT) — keep a marker so we can preserve product words
  n = n.replace(/\*\s*([a-z]+)\b/gi, (m, word: string) => (/\d/.test(word) ? ' ' : ` ${word} `));
  n = n.replace(/\*\s*[\w]+/g, ' ');
  // Conf# references (Zelle)
  n = n.replace(/\bconf#?\s*\w+/gi, '');
  // URLs / domains. Keep the brand label, drop only the TLD + glued location suffix, so
  // "claude.ai" -> "claude", "anthropic.comca" -> "anthropic", "gohighlevel.ctx" -> "gohighlevel",
  // "hostinger.com" -> "hostinger". Deleting the whole token used to erase the brand name.
  n = n.replace(/\bhttps?\S*/gi, ' ');
  n = n.replace(/\bg\.co\/\S*/gi, ' ');
  n = n.replace(/\b([a-z][a-z0-9-]{2,})\.(com|co|net|org|io|ai|ctx|app|dev|cloud|fm)\b[a-z/#]*/gi, ' $1 ');
  // Long alphanumeric IDs (10+ chars, mixed letters+digits)
  n = n.replace(/\b[a-z0-9]*\d[a-z0-9]*[a-z][a-z0-9]*\b/gi, (match) => {
    if (match.length >= 10 && /\d/.test(match) && /[a-z]/i.test(match)) return '';
    return match;
  });
  // Pure numeric sequences of 5+ digits (transaction/store IDs)
  n = n.replace(/\b\d{5,}\b/g, '');
  // Phone numbers
  n = n.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '');
  // Wells Fargo / ACH specific patterns
  n = n.replace(/\bdes:\w+/gi, '');
  n = n.replace(/\bid:\w+/gi, '');
  n = n.replace(/\bindn:[\w\s]+?\bco\b/gi, '');
  n = n.replace(/\bppd\b|\bweb\b/gi, '');
  // Card masking noise
  n = n.replace(/\bckcd\b|\bx{2,}\d*\b/gi, '');
  // "RECURRING" / "INTERNATIONAL TRANSACTION FEE" markers
  n = n.replace(/\brecurring\b/gi, '');
  n = n.replace(/\binternational transaction fee\b/gi, '');
  // Trailing partial phone fragments like "650-"
  n = n.replace(/\b\d{3}-\s*/g, ' ');
  // Trailing US city + 2-letter state at end of string
  n = n.replace(/\s+[a-z]+\s+[a-z]{2}\s*$/i, ' ');
  // Trailing standalone 2-letter state code
  n = n.replace(/\s+[a-z]{2}\s*$/i, ' ');
  // Small standalone numbers (1-4 digits) that are store/location codes
  n = n.replace(/(?<![a-z-])\b\d{1,4}\b(?![a-z-])/g, ' ');
  // Collapse and trim
  n = n.replace(/[*]/g, ' ').replace(/\s+/g, ' ').trim();

  if (n.length < 3) {
    n = desc.toLowerCase().trim();
    n = n.replace(/^(checkcard|mobile purchase|purchase|debit card|pos)\s+\d{4}\s+/i, '');
    n = n.replace(/\b\d{10,}\b/g, '');
    n = n.replace(/#\d+/g, '');
    n = n.replace(/\s+/g, ' ').trim();
  }

  return n;
}

/**
 * Collapse a normalized description to a canonical merchant key so different bank
 * spellings of the same service (Google One / Google Storage, Claude / Anthropic) group
 * together, and so distinct products on one merchant (HighLevel agency vs add-on) stay apart.
 */
export function canonicalMerchant(normalized: string): string {
  const n = normalized;
  if (n.includes('google') && (n.includes('one') || n.includes('storage'))) return 'google one';
  if (n.includes('anthropic') || n.includes('claude')) return 'anthropic';
  if (n.includes('openai') || n.includes('chatgpt')) {
    return n.includes('chatgpt') || n.includes('subscr') ? 'openai chatgpt' : 'openai api';
  }
  if (n.includes('highlevel')) return n.includes('agency') ? 'highlevel agency' : 'highlevel';
  if (n.includes('midjourney')) return 'midjourney';
  if (n.includes('spotify')) return 'spotify';
  if (n.includes('amazon prime')) return 'amazon prime';
  if (n.includes('splice')) return 'splice';
  if (n.includes('f1')) return 'f1 tv';
  if (n.includes('apple')) return 'apple';
  if (n.includes('microsoft') || n.includes('skype')) return 'microsoft';
  if (n.includes('google')) return 'google one';
  // Collapse any other known SaaS merchant to its allowlist token so different bank
  // spellings (hetzner online gmbh / hetzner, hostinger.com / hostinger ...) group together.
  for (const kw of SUBSCRIPTION_ALLOWLIST) {
    if (kw.length >= 5 && n.includes(kw)) return kw;
  }
  return n;
}

function prettyName(canonical: string): string {
  if (DISPLAY_NAMES[canonical]) return DISPLAY_NAMES[canonical];
  return canonical
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function isBlocked(normalized: string, canonical: string): boolean {
  if (BLOCKLIST_EXACT.has(canonical)) return true;
  return BLOCKLIST_SUBSTRINGS.some((kw) => normalized.includes(kw));
}

function isAllowlisted(canonical: string): boolean {
  return SUBSCRIPTION_ALLOWLIST.some((kw) => canonical.includes(kw));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs(b.getTime() - a.getTime()) / msPerDay);
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

/**
 * Classify a median interval (in days) into a billing cycle. Returns null if it matches none.
 */
function classifyBillingCycle(medianDays: number): { cycle: BillingCycle; frequency: number } | null {
  if (medianDays >= 1 && medianDays <= 2) return { cycle: 'DAILY', frequency: Math.round(medianDays) };
  if (medianDays >= 5 && medianDays <= 9) return { cycle: 'WEEKLY', frequency: Math.max(1, Math.round(medianDays / 7)) };
  if (medianDays >= 12 && medianDays <= 17) return { cycle: 'WEEKLY', frequency: 2 };
  if (medianDays >= 25 && medianDays <= 38) return { cycle: 'MONTHLY', frequency: Math.max(1, Math.round(medianDays / 30.44)) };
  if (medianDays >= 55 && medianDays <= 70) return { cycle: 'MONTHLY', frequency: 2 };
  if (medianDays >= 80 && medianDays <= 100) return { cycle: 'MONTHLY', frequency: 3 };
  if (medianDays >= 170 && medianDays <= 200) return { cycle: 'MONTHLY', frequency: 6 };
  if (medianDays >= 340 && medianDays <= 400) return { cycle: 'YEARLY', frequency: 1 };
  return null;
}

function getExpectedIntervalDays(cycle: BillingCycle, frequency: number): number {
  switch (cycle) {
    case 'DAILY':
      return frequency;
    case 'WEEKLY':
      return 7 * frequency;
    case 'MONTHLY':
      return 30.44 * frequency;
    case 'YEARLY':
      return 365.25 * frequency;
  }
}

function predictNextPayment(lastSeen: Date, cycle: BillingCycle, frequency: number): Date {
  const next = new Date(lastSeen);
  switch (cycle) {
    case 'DAILY':
      next.setUTCDate(next.getUTCDate() + frequency);
      break;
    case 'WEEKLY':
      next.setUTCDate(next.getUTCDate() + 7 * frequency);
      break;
    case 'MONTHLY':
      next.setUTCMonth(next.getUTCMonth() + frequency);
      break;
    case 'YEARLY':
      next.setUTCFullYear(next.getUTCFullYear() + frequency);
      break;
  }
  return next;
}

/**
 * Inactive if the last charge is older than INACTIVE_MULTIPLIER billing cycles before the
 * reference date. referenceDate is the dataset's freshness (latest transaction), NOT today —
 * otherwise every subscription looks dead whenever the current month's statement isn't uploaded.
 */
function isLikelyInactive(
  lastSeen: Date,
  cycle: BillingCycle,
  frequency: number,
  referenceDate: Date
): boolean {
  const expectedDays = getExpectedIntervalDays(cycle, frequency);
  return daysBetween(lastSeen, referenceDate) > expectedDays * INACTIVE_MULTIPLIER;
}

/**
 * Detect recurring subscription patterns from transactions.
 */
export function detectSubscriptions(
  transactions: {
    id: string;
    description: string;
    amount: number;
    date: Date;
    type: string;
    accountId: string;
    categoryId: string | null;
  }[],
  options: { excludedCategoryIds?: Set<string> } = {}
): DetectedPattern[] {
  const excluded = options.excludedCategoryIds ?? new Set<string>();

  // Pre-filter: expenses only, above the noise floor, not in an excluded category.
  const expenses = transactions.filter(
    (t) =>
      t.type === 'EXPENSE' &&
      t.amount >= MIN_AMOUNT &&
      !(t.categoryId && excluded.has(t.categoryId))
  );

  // Group by canonical merchant + accountId, dropping blocklisted merchants.
  const groups = new Map<string, (typeof expenses[number] & { canonical: string })[]>();

  for (const tx of expenses) {
    const normalized = normalizeDescription(tx.description);
    const canonical = canonicalMerchant(normalized);
    if (!canonical || canonical.length < 3) continue;
    if (isBlocked(normalized, canonical)) continue;

    const key = `${canonical}::${tx.accountId}`;
    const enriched = { ...tx, canonical };
    const group = groups.get(key);
    if (group) group.push(enriched);
    else groups.set(key, [enriched]);
  }

  const patterns: DetectedPattern[] = [];

  for (const group of groups.values()) {
    if (group.length < MIN_OCCURRENCES) continue;

    group.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Read identity from the group itself — the map key packs canonical + accountId with a
    // '::' separator, but canonicals can contain colons, so parsing the key is unreliable.
    const canonical = group[0].canonical;
    const accountId = group[0].accountId;
    const allowlisted = isAllowlisted(canonical);

    // Per-month aggregation
    const monthlyTotals = new Map<string, number>();
    for (const tx of group) {
      monthlyTotals.set(monthKey(tx.date), (monthlyTotals.get(monthKey(tx.date)) ?? 0) + tx.amount);
    }
    const distinctMonths = monthlyTotals.size;
    const spanDays = daysBetween(group[0].date, group[group.length - 1].date);

    // Intervals & cadence
    const intervals: number[] = [];
    for (let i = 1; i < group.length; i++) intervals.push(daysBetween(group[i - 1].date, group[i].date));
    const medianInterval = intervals.length ? median(intervals) : 30;
    const classified = classifyBillingCycle(medianInterval);

    // Usage-style billing: many charges per month => treat as a monthly plan on the monthly total.
    const chargesPerMonth = group.length / distinctMonths;
    const usageStyle = chargesPerMonth > USAGE_CHARGES_PER_MONTH;

    let cycle: BillingCycle;
    let frequency: number;
    if (usageStyle || !classified) {
      // Fall back to monthly for usage-style/irregular merchants (only kept if recurrence holds).
      cycle = 'MONTHLY';
      frequency = 1;
    } else {
      cycle = classified.cycle;
      frequency = classified.frequency;
    }

    // Recurrence requirement
    const isShortCycle = cycle === 'WEEKLY' || cycle === 'DAILY';
    const recurs = isShortCycle
      ? spanDays >= MIN_SPAN_DAYS_SHORT
      : distinctMonths >= MIN_DISTINCT_MONTHS;
    if (!recurs) continue;

    // Amount series + price
    const series = usageStyle ? [...monthlyTotals.values()] : group.map((t) => t.amount);
    const priceMedian = median(series);
    if (priceMedian <= 0) continue;

    // Precision gate for unknown merchants: require a clean billing interval (not a
    // usage-style fallback) AND tight amount regularity. This drops restaurants, retail and
    // other erratic recurring spend that real fixed-price subscriptions don't exhibit.
    if (!allowlisted) {
      if (!classified) continue;
      const regular = series.filter(
        (v) => Math.abs(v - priceMedian) / priceMedian <= AMOUNT_REGULARITY_TOLERANCE
      ).length;
      if (regular / series.length < AMOUNT_REGULARITY_FRACTION) continue;
    }

    const mostRecent = group[group.length - 1];

    patterns.push({
      normalizedDescription: canonical,
      displayName: prettyName(canonical),
      billingCycle: cycle,
      frequency,
      avgAmount: Math.round(priceMedian * 100) / 100,
      dates: group.map((t) => t.date),
      firstSeen: group[0].date,
      lastSeen: mostRecent.date,
      occurrences: group.length,
      intervalDays: Math.round(medianInterval),
      accountId,
      categoryId: mostRecent.categoryId,
    });
  }

  return patterns;
}

/**
 * Run detection and upsert subscriptions in the database.
 */
export async function detectAndUpsertSubscriptions(
  accountId?: string,
  opts: { dryRun?: boolean } = {}
): Promise<DetectionResult & { patterns?: DetectedPattern[] }> {
  const where: { type: 'EXPENSE'; accountId?: string } = { type: 'EXPENSE' };
  if (accountId) where.accountId = accountId;

  const [transactions, categories] = await Promise.all([
    prisma.transaction.findMany({
      where,
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        type: true,
        accountId: true,
        categoryId: true,
      },
      orderBy: { date: 'asc' },
    }),
    prisma.category.findMany({ select: { id: true, name: true } }),
  ]);

  // Reference date = dataset freshness, computed PER ACCOUNT (latest charge on that account),
  // so a subscription isn't retired just because a *different* account has fresher statements
  // or because the current month's statement for its account hasn't been imported yet.
  const refByAccount = new Map<string, Date>();
  for (const t of transactions) {
    const cur = refByAccount.get(t.accountId);
    if (!cur || t.date > cur) refByAccount.set(t.accountId, t.date);
  }
  const globalRef = transactions.reduce((max, t) => (t.date > max ? t.date : max), new Date(0));
  const fallbackRef = globalRef.getTime() > 0 ? globalRef : new Date();
  const refFor = (acct: string): Date => refByAccount.get(acct) ?? fallbackRef;

  const excludedCategoryIds = new Set(
    categories.filter((c) => EXCLUDED_CATEGORY_NAMES.has(c.name.toLowerCase())).map((c) => c.id)
  );

  const patterns = detectSubscriptions(
    transactions.map((t) => ({ ...t, type: t.type as string })),
    { excludedCategoryIds }
  );

  if (opts.dryRun) {
    const existingDetected = await prisma.subscription.findMany({
      where: { source: 'detected', ...(accountId ? { accountId } : {}) },
      select: { id: true, name: true, matchPattern: true, accountId: true },
    });
    const validKeysDry = new Set(patterns.map((p) => `${p.normalizedDescription}::${p.accountId}`));
    const wouldDelete = existingDetected.filter(
      (s) => !validKeysDry.has(`${s.matchPattern}::${s.accountId}`)
    );
    return {
      detected: patterns.length,
      created: 0,
      updated: 0,
      markedInactive: 0,
      deletedOrphans: wouldDelete.length,
      patterns: patterns.map((p) => ({
        ...p,
        inactive: isLikelyInactive(p.lastSeen, p.billingCycle, p.frequency, refFor(p.accountId)),
      })) as never,
    };
  }

  let created = 0;
  let updated = 0;

  for (const pattern of patterns) {
    const existing = await prisma.subscription.findFirst({
      where: { matchPattern: pattern.normalizedDescription, accountId: pattern.accountId },
    });

    const shouldBeInactive = isLikelyInactive(
      pattern.lastSeen,
      pattern.billingCycle,
      pattern.frequency,
      refFor(pattern.accountId)
    );

    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          lastSeenDate: pattern.lastSeen,
          firstSeenDate: pattern.firstSeen,
          occurrences: pattern.occurrences,
          avgAmount: pattern.avgAmount,
          inactive: shouldBeInactive,
          ...(existing.source === 'detected' ? { price: pattern.avgAmount } : {}),
          ...(existing.source === 'detected'
            ? { nextPayment: predictNextPayment(pattern.lastSeen, pattern.billingCycle, pattern.frequency) }
            : {}),
        },
      });
      updated++;
    } else {
      await prisma.subscription.create({
        data: {
          name: pattern.displayName,
          price: pattern.avgAmount,
          billingCycle: pattern.billingCycle,
          frequency: pattern.frequency,
          nextPayment: predictNextPayment(pattern.lastSeen, pattern.billingCycle, pattern.frequency),
          source: 'detected',
          matchPattern: pattern.normalizedDescription,
          lastSeenDate: pattern.lastSeen,
          firstSeenDate: pattern.firstSeen,
          occurrences: pattern.occurrences,
          avgAmount: pattern.avgAmount,
          accountId: pattern.accountId,
          categoryId: pattern.categoryId,
          autoRenew: true,
          inactive: shouldBeInactive,
        },
      });
      created++;
    }
  }

  // Mark surviving detected subscriptions inactive when stale relative to the dataset.
  const activeDetected = await prisma.subscription.findMany({
    where: { source: 'detected', inactive: false, ...(accountId ? { accountId } : {}) },
  });

  let markedInactive = 0;
  for (const sub of activeDetected) {
    if (sub.lastSeenDate && isLikelyInactive(sub.lastSeenDate, sub.billingCycle, sub.frequency, refFor(sub.accountId ?? ''))) {
      const wasUpdated = patterns.some(
        (p) => p.normalizedDescription === sub.matchPattern && p.accountId === sub.accountId
      );
      if (!wasUpdated) {
        await prisma.subscription.update({ where: { id: sub.id }, data: { inactive: true } });
        markedInactive++;
      }
    }
  }

  // Remove orphaned auto-detected subscriptions: anything the improved detector no longer
  // recognizes was a false positive (fragments, transfers, fuel, BNPL, fees). Manual
  // subscriptions are never touched, and genuinely-cancelled real subs still match (and are
  // simply flagged inactive above), so deletion here only clears junk.
  const validKeys = new Set(patterns.map((p) => `${p.normalizedDescription}::${p.accountId}`));
  const detectedSubs = await prisma.subscription.findMany({
    where: { source: 'detected', ...(accountId ? { accountId } : {}) },
    select: { id: true, matchPattern: true, accountId: true },
  });
  const orphanIds = detectedSubs
    .filter((s) => !validKeys.has(`${s.matchPattern}::${s.accountId}`))
    .map((s) => s.id);

  let deletedOrphans = 0;
  if (orphanIds.length > 0) {
    const res = await prisma.subscription.deleteMany({ where: { id: { in: orphanIds } } });
    deletedOrphans = res.count;
  }

  return {
    detected: patterns.length,
    created,
    updated,
    markedInactive,
    deletedOrphans,
  };
}
