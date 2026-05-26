import { prisma } from '@/lib/db';

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
