import { prisma } from '@/lib/db';
import { computeGoalProgress } from './calculations';
import type { Goal, GoalAiContext } from './types';

const MONTHS_WINDOW = 6;

// Normalize a subscription price to a monthly cost based on its billing cycle.
function monthlySubscriptionCost(sub: {
  price: number;
  billingCycle: string;
  frequency: number;
}): number {
  const freq = sub.frequency > 0 ? sub.frequency : 1;
  switch (sub.billingCycle) {
    case 'DAILY':
      return (sub.price / freq) * 30;
    case 'WEEKLY':
      return (sub.price / freq) * (52 / 12);
    case 'YEARLY':
      return sub.price / freq / 12;
    case 'MONTHLY':
    default:
      return sub.price / freq;
  }
}

/**
 * Assemble real financial context from existing Xpend data for the AI planner.
 * Everything here is derived from stored records; nothing is fabricated. When
 * there is no transaction history, hasData is false and the figures are zero so
 * the planner can state that assumption explicitly.
 */
export async function buildGoalAiContext(currentGoalId?: string): Promise<GoalAiContext> {
  const since = new Date();
  since.setMonth(since.getMonth() - MONTHS_WINDOW);

  const [transactions, accounts, subscriptions, goals] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: since }, type: { in: ['INCOME', 'EXPENSE'] } },
      select: {
        type: true,
        amount: true,
        date: true,
        category: { select: { name: true } },
      },
    }),
    prisma.account.findMany({ select: { initialBalance: true } }),
    prisma.subscription.findMany({
      where: { inactive: false },
      select: { price: true, billingCycle: true, frequency: true },
    }),
    prisma.goal.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        targetAmount: true,
        currentAmount: true,
        targetDate: true,
      },
    }),
  ]);

  // Count distinct months that actually have data so averages aren't diluted by
  // empty months at the start of the window.
  const monthKeys = new Set<string>();
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryTotals = new Map<string, number>();

  for (const t of transactions) {
    monthKeys.add(`${t.date.getFullYear()}-${t.date.getMonth()}`);
    if (t.type === 'INCOME') {
      totalIncome += t.amount;
    } else if (t.type === 'EXPENSE') {
      totalExpenses += t.amount;
      const name = t.category?.name ?? 'Uncategorized';
      categoryTotals.set(name, (categoryTotals.get(name) ?? 0) + t.amount);
    }
  }

  const monthsAnalyzed = Math.max(1, monthKeys.size);
  const avgMonthlyIncome = totalIncome / monthsAnalyzed;
  const avgMonthlyExpenses = totalExpenses / monthsAnalyzed;

  const topExpenseCategories = Array.from(categoryTotals.entries())
    .map(([name, total]) => ({ name, monthlyAvg: total / monthsAnalyzed }))
    .sort((a, b) => b.monthlyAvg - a.monthlyAvg)
    .slice(0, 6);

  const monthlySubs = subscriptions.reduce((sum, s) => sum + monthlySubscriptionCost(s), 0);

  const estimatedTotalBalance = accounts.reduce((sum, a) => sum + a.initialBalance, 0)
    + totalIncome - totalExpenses;

  const otherActiveGoals = goals
    .filter((g) => g.id !== currentGoalId)
    .map((g) => {
      const calc = computeGoalProgress(g as unknown as Goal);
      return { name: g.name, requiredMonthly: calc.requiredMonthly };
    });

  return {
    hasData: transactions.length > 0,
    monthsAnalyzed,
    avgMonthlyIncome,
    avgMonthlyExpenses,
    avgMonthlySurplus: avgMonthlyIncome - avgMonthlyExpenses,
    monthlySubscriptionCost: monthlySubs,
    estimatedTotalBalance,
    topExpenseCategories,
    otherActiveGoals,
  };
}
