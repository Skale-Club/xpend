import { prisma } from '@/lib/db';
import { validateGoalData, validateContributionData } from '@/lib/validation';
import { buildGoalData } from '@/lib/goals/payload';

export async function categorize_transaction(params: {
  transactionId: string;
  categoryId: string | null;
}) {
  const transaction = await prisma.transaction.update({
    where: { id: params.transactionId },
    data: { categoryId: params.categoryId ?? null },
    include: { category: { select: { name: true } } },
  });

  return {
    success: true,
    transaction: {
      id: transaction.id,
      description: transaction.description,
      category: transaction.category?.name ?? null,
    },
  };
}

export async function update_transaction_notes(params: {
  transactionId: string;
  notes: string | null;
}) {
  const transaction = await prisma.transaction.update({
    where: { id: params.transactionId },
    data: { notes: params.notes ?? null },
    select: { id: true, description: true, notes: true },
  });

  return { success: true, transaction };
}

export async function mark_transaction_recurring(params: {
  transactionId: string;
  isRecurring: boolean;
}) {
  const transaction = await prisma.transaction.update({
    where: { id: params.transactionId },
    data: { isRecurring: params.isRecurring },
    select: { id: true, description: true, isRecurring: true },
  });

  return { success: true, transaction };
}

export async function categorize_by_description(params: {
  searchPattern: string;
  categoryId: string;
  maxTransactions?: number;
}) {
  const max = Math.min(params.maxTransactions ?? 50, 200);

  const matches = await prisma.transaction.findMany({
    where: { description: { contains: params.searchPattern, mode: 'insensitive' } },
    select: { id: true },
    take: max,
  });

  if (matches.length === 0) {
    return { success: true, updatedCount: 0 };
  }

  const result = await prisma.transaction.updateMany({
    where: { id: { in: matches.map((m) => m.id) } },
    data: { categoryId: params.categoryId },
  });

  return { success: true, updatedCount: result.count };
}

export async function create_goal(params: {
  name: string;
  type: 'SAVINGS' | 'TRAVEL' | 'DEBT_PAYOFF' | 'PURCHASE' | 'EMERGENCY_FUND';
  targetAmount: number;
  currentAmount?: number;
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  targetDate?: string | null;
  interestRate?: number | null;
  minimumPayment?: number | null;
  monthsOfCoverage?: number | null;
  description?: string | null;
  linkedAccountId?: string | null;
  linkedCategoryId?: string | null;
}) {
  validateGoalData(params as Record<string, unknown>);

  const goal = await prisma.goal.create({
    data: buildGoalData(params as Record<string, unknown>),
    include: {
      linkedAccount: { select: { id: true, name: true, color: true } },
      linkedCategory: { select: { id: true, name: true, color: true } },
    },
  });

  return {
    success: true,
    goal: {
      id: goal.id,
      name: goal.name,
      type: goal.type,
      status: goal.status,
      priority: goal.priority,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      targetDate: goal.targetDate,
      linkedAccount: goal.linkedAccount?.name ?? null,
    },
  };
}

export async function update_goal(params: {
  goalId: string;
  name?: string;
  type?: 'SAVINGS' | 'TRAVEL' | 'DEBT_PAYOFF' | 'PURCHASE' | 'EMERGENCY_FUND';
  targetAmount?: number;
  currentAmount?: number;
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  targetDate?: string | null;
  interestRate?: number | null;
  minimumPayment?: number | null;
  monthsOfCoverage?: number | null;
  description?: string | null;
  linkedAccountId?: string | null;
  linkedCategoryId?: string | null;
}) {
  const { goalId, ...updates } = params;

  const existing = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!existing) {
    throw new Error('Goal not found');
  }

  // Merge provided fields over the existing goal so the shared validator and
  // payload builder can run on a complete object (this is a partial update).
  const merged: Record<string, unknown> = {
    name: existing.name,
    type: existing.type,
    status: existing.status,
    priority: existing.priority,
    targetAmount: existing.targetAmount,
    currentAmount: existing.currentAmount,
    targetDate: existing.targetDate,
    interestRate: existing.interestRate,
    minimumPayment: existing.minimumPayment,
    monthsOfCoverage: existing.monthsOfCoverage,
    metadata: existing.metadata,
    description: existing.description,
    linkedAccountId: existing.linkedAccountId,
    linkedCategoryId: existing.linkedCategoryId,
  };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) merged[key] = value;
  }

  validateGoalData(merged);

  const goal = await prisma.goal.update({
    where: { id: goalId },
    data: buildGoalData(merged),
    include: {
      linkedAccount: { select: { id: true, name: true } },
      linkedCategory: { select: { id: true, name: true } },
    },
  });

  return {
    success: true,
    goal: {
      id: goal.id,
      name: goal.name,
      type: goal.type,
      status: goal.status,
      priority: goal.priority,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      targetDate: goal.targetDate,
      linkedAccount: goal.linkedAccount?.name ?? null,
    },
  };
}

export async function delete_goal(params: { goalId: string }) {
  await prisma.goal.delete({ where: { id: params.goalId } });
  return { success: true, deletedId: params.goalId };
}

export async function add_goal_contribution(params: {
  goalId: string;
  amount: number;
  date?: string | null;
  accountId?: string | null;
  transactionId?: string | null;
  note?: string | null;
}) {
  validateContributionData(params as Record<string, unknown>);

  const goal = await prisma.goal.findUnique({ where: { id: params.goalId }, select: { id: true } });
  if (!goal) {
    throw new Error('Goal not found');
  }

  const amount = Number(params.amount);

  const [contribution, updatedGoal] = await prisma.$transaction([
    prisma.goalContribution.create({
      data: {
        goalId: params.goalId,
        amount,
        date: params.date ? new Date(params.date) : new Date(),
        accountId: params.accountId || null,
        transactionId: params.transactionId || null,
        note: params.note ? String(params.note).trim() : null,
      },
      include: { account: { select: { id: true, name: true } } },
    }),
    prisma.goal.update({
      where: { id: params.goalId },
      data: { currentAmount: { increment: amount } },
      select: { id: true, name: true, targetAmount: true, currentAmount: true },
    }),
  ]);

  return {
    success: true,
    contribution: {
      id: contribution.id,
      amount: contribution.amount,
      date: contribution.date,
      account: contribution.account?.name ?? null,
      note: contribution.note,
    },
    goal: {
      id: updatedGoal.id,
      name: updatedGoal.name,
      targetAmount: updatedGoal.targetAmount,
      currentAmount: updatedGoal.currentAmount,
      remaining: Math.max(updatedGoal.targetAmount - updatedGoal.currentAmount, 0),
    },
  };
}

export async function create_categorization_rule(params: {
  keywords: string;
  categoryId: string;
  matchType?: 'exact' | 'contains' | 'regex';
}) {
  const category = await prisma.category.findUnique({
    where: { id: params.categoryId },
    select: { name: true },
  });

  if (!category) {
    throw new Error('Category not found');
  }

  const rule = await prisma.categorizationRule.create({
    data: {
      categoryId: params.categoryId,
      keywords: params.keywords,
      matchType: params.matchType ?? 'contains',
      priority: 1,
      isActive: true,
    },
  });

  return {
    success: true,
    rule: {
      id: rule.id,
      keywords: rule.keywords,
      matchType: rule.matchType,
      categoryName: category.name,
    },
  };
}
