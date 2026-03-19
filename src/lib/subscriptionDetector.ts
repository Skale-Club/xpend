import { prisma } from '@/lib/db';
import type { BillingCycle } from '@/generated/prisma';

export interface DetectedPattern {
  normalizedDescription: string;
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
}

const MIN_OCCURRENCES = 3;
const AMOUNT_TOLERANCE = 0.10; // 10% tolerance on amount variation
const INTERVAL_TOLERANCE = 0.20; // 20% tolerance on interval regularity
const REGULARITY_THRESHOLD = 0.70; // 70% of intervals must be within tolerance
const INACTIVE_MULTIPLIER = 1.5; // 1.5x billing cycle without transaction = inactive

/**
 * Normalize a transaction description for grouping.
 * Lowercases, trims, and removes trailing IDs/numbers that banks append.
 */
export function normalizeDescription(desc: string): string {
  let normalized = desc.toLowerCase().trim();

  // Remove trailing reference numbers like *12345, #12345, REF12345
  normalized = normalized.replace(/[\s]*[*#]\s*\d+$/g, '');

  // Remove trailing pure numeric sequences (6+ digits, likely reference IDs)
  normalized = normalized.replace(/\s+\d{6,}$/g, '');

  // Remove trailing dates in common formats (dd/mm, mm/dd, dd-mm)
  normalized = normalized.replace(/\s+\d{1,2}[/-]\d{1,2}(\/\d{2,4})?$/g, '');

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Calculate the median of an array of numbers.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate days between two dates (UTC).
 */
function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs(b.getTime() - a.getTime()) / msPerDay);
}

/**
 * Classify a median interval (in days) into a billing cycle.
 * Returns null if the interval doesn't match any known cycle.
 */
function classifyBillingCycle(
  medianDays: number
): { cycle: BillingCycle; frequency: number } | null {
  // Daily: 1-2 days
  if (medianDays >= 1 && medianDays <= 2) {
    return { cycle: 'DAILY', frequency: Math.round(medianDays) };
  }
  // Weekly: 5-9 days
  if (medianDays >= 5 && medianDays <= 9) {
    return { cycle: 'WEEKLY', frequency: Math.max(1, Math.round(medianDays / 7)) };
  }
  // Biweekly: 12-17 days
  if (medianDays >= 12 && medianDays <= 17) {
    return { cycle: 'WEEKLY', frequency: 2 };
  }
  // Monthly: 25-38 days
  if (medianDays >= 25 && medianDays <= 38) {
    return { cycle: 'MONTHLY', frequency: Math.max(1, Math.round(medianDays / 30.44)) };
  }
  // Bimonthly: 55-70 days
  if (medianDays >= 55 && medianDays <= 70) {
    return { cycle: 'MONTHLY', frequency: 2 };
  }
  // Quarterly: 80-100 days
  if (medianDays >= 80 && medianDays <= 100) {
    return { cycle: 'MONTHLY', frequency: 3 };
  }
  // Semi-annual: 170-200 days
  if (medianDays >= 170 && medianDays <= 200) {
    return { cycle: 'MONTHLY', frequency: 6 };
  }
  // Yearly: 340-400 days
  if (medianDays >= 340 && medianDays <= 400) {
    return { cycle: 'YEARLY', frequency: 1 };
  }
  return null;
}

/**
 * Get the expected interval in days for a billing cycle.
 */
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

/**
 * Predict the next payment date based on last seen date and billing cycle.
 */
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
 * Determine if a subscription is likely inactive based on when it was last seen.
 */
function isLikelyInactive(lastSeen: Date, cycle: BillingCycle, frequency: number): boolean {
  const expectedDays = getExpectedIntervalDays(cycle, frequency);
  const daysSinceLastSeen = daysBetween(lastSeen, new Date());
  return daysSinceLastSeen > expectedDays * INACTIVE_MULTIPLIER;
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
  }[]
): DetectedPattern[] {
  // Only consider expenses
  const expenses = transactions.filter((t) => t.type === 'EXPENSE');

  // Group by normalized description + accountId
  const groups = new Map<
    string,
    typeof expenses
  >();

  for (const tx of expenses) {
    const key = `${normalizeDescription(tx.description)}::${tx.accountId}`;
    const group = groups.get(key);
    if (group) {
      group.push(tx);
    } else {
      groups.set(key, [tx]);
    }
  }

  const patterns: DetectedPattern[] = [];

  for (const [key, group] of groups) {
    if (group.length < MIN_OCCURRENCES) continue;

    // Sort by date ascending
    group.sort((a, b) => a.date.getTime() - b.date.getTime());

    const amounts = group.map((t) => t.amount);
    const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;

    // Check amount consistency: coefficient of variation must be <= tolerance
    if (mean === 0) continue;
    const variance = amounts.reduce((sum, a) => sum + (a - mean) ** 2, 0) / amounts.length;
    const stddev = Math.sqrt(variance);
    const cv = stddev / mean;
    if (cv > AMOUNT_TOLERANCE) continue;

    // Calculate intervals between consecutive transactions
    const intervals: number[] = [];
    for (let i = 1; i < group.length; i++) {
      intervals.push(daysBetween(group[i - 1].date, group[i].date));
    }

    if (intervals.length === 0) continue;

    const medianInterval = median(intervals);
    if (medianInterval < 1) continue;

    // Classify billing cycle
    const classification = classifyBillingCycle(medianInterval);
    if (!classification) continue;

    // Check interval regularity
    const withinTolerance = intervals.filter(
      (d) => Math.abs(d - medianInterval) / medianInterval <= INTERVAL_TOLERANCE
    );
    if (withinTolerance.length / intervals.length < REGULARITY_THRESHOLD) continue;

    const [normalizedDesc, accountId] = key.split('::');

    // Use the most recent transaction's description for display name (original casing)
    const mostRecent = group[group.length - 1];

    patterns.push({
      normalizedDescription: normalizedDesc,
      displayName: mostRecent.description,
      billingCycle: classification.cycle,
      frequency: classification.frequency,
      avgAmount: Math.round(mean * 100) / 100,
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
  accountId?: string
): Promise<DetectionResult> {
  // Fetch all expense transactions
  const where: { type: 'EXPENSE'; accountId?: string } = { type: 'EXPENSE' };
  if (accountId) where.accountId = accountId;

  const transactions = await prisma.transaction.findMany({
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
  });

  const patterns = detectSubscriptions(
    transactions.map((t) => ({
      ...t,
      type: t.type as string,
    }))
  );

  let created = 0;
  let updated = 0;

  for (const pattern of patterns) {
    // Check if subscription already exists by matchPattern + accountId
    const existing = await prisma.subscription.findFirst({
      where: {
        matchPattern: pattern.normalizedDescription,
        accountId: pattern.accountId,
      },
    });

    const shouldBeInactive = isLikelyInactive(
      pattern.lastSeen,
      pattern.billingCycle,
      pattern.frequency
    );

    if (existing) {
      // Update metadata only — never overwrite user-edited fields
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          lastSeenDate: pattern.lastSeen,
          firstSeenDate: pattern.firstSeen,
          occurrences: pattern.occurrences,
          avgAmount: pattern.avgAmount,
          inactive: shouldBeInactive,
          // Only update price if user hasn't manually changed it
          ...(existing.source === 'detected' ? { price: pattern.avgAmount } : {}),
          // Only update nextPayment for detected subscriptions
          ...(existing.source === 'detected'
            ? {
                nextPayment: predictNextPayment(
                  pattern.lastSeen,
                  pattern.billingCycle,
                  pattern.frequency
                ),
              }
            : {}),
        },
      });
      updated++;
    } else {
      // Create new detected subscription
      await prisma.subscription.create({
        data: {
          name: pattern.displayName,
          price: pattern.avgAmount,
          billingCycle: pattern.billingCycle,
          frequency: pattern.frequency,
          nextPayment: predictNextPayment(
            pattern.lastSeen,
            pattern.billingCycle,
            pattern.frequency
          ),
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

  // Mark stale detected subscriptions as inactive
  const activeDetected = await prisma.subscription.findMany({
    where: {
      source: 'detected',
      inactive: false,
      ...(accountId ? { accountId } : {}),
    },
  });

  let markedInactive = 0;
  for (const sub of activeDetected) {
    if (
      sub.lastSeenDate &&
      isLikelyInactive(sub.lastSeenDate, sub.billingCycle, sub.frequency)
    ) {
      // Check if this subscription was already updated in this run
      const wasUpdated = patterns.some(
        (p) => p.normalizedDescription === sub.matchPattern && p.accountId === sub.accountId
      );
      if (!wasUpdated) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { inactive: true },
        });
        markedInactive++;
      }
    }
  }

  return {
    detected: patterns.length,
    created,
    updated,
    markedInactive,
  };
}
