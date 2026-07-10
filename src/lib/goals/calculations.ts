import type { Goal, GoalCalculation } from './types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_MONTH = 365.25 / 12;
const DAYS_PER_WEEK = 7;

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Whole days from `from` until `to`, never negative. Returns 0 once the
 * target date has passed so callers don't divide by a negative window.
 */
export function daysUntil(target: Date, from: Date = new Date()): number {
  const diff = target.getTime() - from.getTime();
  return Math.max(0, Math.ceil(diff / MS_PER_DAY));
}

/**
 * Core progress + savings-requirement calculation shared by all goal types.
 *
 * Every goal type — including debt payoff — stores targetAmount as the total to
 * reach (for debts, the full amount owed) and currentAmount as what has been
 * accumulated/paid so far, so remaining = target - current works uniformly.
 * (See debt-strategy route and debtPayoffSummary, which compute the balance
 * still owed as targetAmount - currentAmount.)
 */
export function computeGoalProgress(goal: Goal, now: Date = new Date()): GoalCalculation {
  const target = Number(goal.targetAmount) || 0;
  const current = Number(goal.currentAmount) || 0;

  const amountRemaining = Math.max(0, target - current);
  const percentComplete =
    target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
  const isComplete = target > 0 && current >= target;

  const targetDate = toDate(goal.targetDate);

  if (!targetDate) {
    return {
      amountRemaining,
      percentComplete,
      monthsRemaining: null,
      daysRemaining: null,
      requiredMonthly: null,
      requiredWeekly: null,
      requiredDaily: null,
      isComplete,
    };
  }

  const daysRemaining = daysUntil(targetDate, now);
  const monthsRemaining = daysRemaining / DAYS_PER_MONTH;

  // Already complete: nothing more to save.
  if (isComplete || amountRemaining === 0) {
    return {
      amountRemaining,
      percentComplete,
      monthsRemaining,
      daysRemaining,
      requiredMonthly: 0,
      requiredWeekly: 0,
      requiredDaily: 0,
      isComplete,
    };
  }

  // Deadline reached but goal not met: the full remaining amount is due now.
  if (daysRemaining === 0) {
    return {
      amountRemaining,
      percentComplete,
      monthsRemaining: 0,
      daysRemaining: 0,
      requiredMonthly: amountRemaining,
      requiredWeekly: amountRemaining,
      requiredDaily: amountRemaining,
      isComplete,
    };
  }

  return {
    amountRemaining,
    percentComplete,
    monthsRemaining,
    daysRemaining,
    requiredMonthly: amountRemaining / (daysRemaining / DAYS_PER_MONTH),
    requiredWeekly: amountRemaining / (daysRemaining / DAYS_PER_WEEK),
    requiredDaily: amountRemaining / daysRemaining,
    isComplete,
  };
}

/**
 * Emergency-fund target derived from historical monthly expenses.
 * Returns the target amount the goal should aim for given desired coverage.
 */
export function emergencyFundTarget(
  monthsOfCoverage: number | null | undefined,
  avgMonthlyExpenses: number,
): number {
  const months = Math.max(0, Number(monthsOfCoverage) || 0);
  return months * Math.max(0, avgMonthlyExpenses);
}

/**
 * Months of coverage currently saved given average monthly expenses.
 */
export function monthsCovered(currentAmount: number, avgMonthlyExpenses: number): number {
  if (avgMonthlyExpenses <= 0) return 0;
  return currentAmount / avgMonthlyExpenses;
}
