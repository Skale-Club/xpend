import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma';
import { computeAvailableLimit } from '@/lib/creditCard/limit';

export async function get_transactions(params: {
  dateFrom?: string;
  dateTo?: string;
  accountId?: string;
  categoryId?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const where: Prisma.TransactionWhereInput = {};

  if (params.dateFrom || params.dateTo) {
    where.date = {
      ...(params.dateFrom && { gte: new Date(params.dateFrom) }),
      ...(params.dateTo && { lte: new Date(params.dateTo) }),
    };
  }
  if (params.accountId) where.accountId = params.accountId;
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.minAmount !== undefined || params.maxAmount !== undefined) {
    where.amount = {
      ...(params.minAmount !== undefined && { gte: params.minAmount }),
      ...(params.maxAmount !== undefined && { lte: params.maxAmount }),
    };
  }
  if (params.search) {
    where.OR = [
      { description: { contains: params.search, mode: 'insensitive' } },
      { notes: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;
  const total = await prisma.transaction.count({ where });

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: 'desc' },
    take: limit,
    skip: offset,
    include: {
      category: { select: { id: true, name: true, color: true } },
      account: { select: { id: true, name: true } },
    },
  });

  return {
    total,
    limit,
    offset,
    hasMore: offset + transactions.length < total,
    transactions: transactions.map((t) => ({
      id: t.id,
      date: t.date.toISOString().split('T')[0],
      description: t.description,
      amount: t.amount,
      type: t.type,
      isRecurring: t.isRecurring,
      notes: t.notes,
      category: t.category ? { id: t.category.id, name: t.category.name } : null,
      account: { id: t.account.id, name: t.account.name },
    })),
  };
}

export async function get_accounts(_params: Record<string, never>) {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, type: true, bank: true, color: true, icon: true,
      creditLimit: true, closingDay: true, dueDay: true, lastFour: true, brand: true,
      invoices: {
        orderBy: [{ referenceYear: 'desc' }, { referenceMonth: 'desc' }],
        select: {
          status: true, totalAmount: true, paidAmount: true, availableLimitSnapshot: true,
          referenceMonth: true, referenceYear: true,
        },
      },
    },
  });

  const totals = await prisma.transaction.groupBy({
    by: ['accountId', 'type'],
    _sum: { amount: true },
  });

  const balanceMap = new Map<string, number>();
  for (const row of totals) {
    const prev = balanceMap.get(row.accountId) ?? 0;
    const amount = row._sum.amount ?? 0;
    balanceMap.set(
      row.accountId,
      row.type === 'INCOME' ? prev + amount : prev - amount
    );
  }

  return {
    accounts: accounts.map(({ invoices, ...a }) => {
      const isCard = a.type === 'CREDIT_CARD';
      return {
        ...a,
        currentBalance: balanceMap.get(a.id) ?? 0,
        ...(isCard
          ? { availableLimit: computeAvailableLimit(a.creditLimit, invoices) }
          : {}),
      };
    }),
  };
}

export async function get_credit_card_invoices(params: { accountId?: string }) {
  const where: Prisma.CreditCardInvoiceWhereInput = {};
  if (params.accountId) where.accountId = params.accountId;

  const invoices = await prisma.creditCardInvoice.findMany({
    where,
    orderBy: [{ referenceYear: 'desc' }, { referenceMonth: 'desc' }],
    include: {
      account: { select: { id: true, name: true } },
      _count: { select: { transactions: true } },
    },
  });

  return {
    invoices: invoices.map((inv) => ({
      id: inv.id,
      account: { id: inv.account.id, name: inv.account.name },
      referenceMonth: inv.referenceMonth,
      referenceYear: inv.referenceYear,
      closingDate: inv.closingDate ? inv.closingDate.toISOString().split('T')[0] : null,
      dueDate: inv.dueDate ? inv.dueDate.toISOString().split('T')[0] : null,
      totalAmount: inv.totalAmount,
      minimumPayment: inv.minimumPayment,
      paidAmount: inv.paidAmount,
      status: inv.status,
      transactionCount: inv._count.transactions,
    })),
  };
}

export async function get_invoice(params: { invoiceId: string }) {
  const invoice = await prisma.creditCardInvoice.findUnique({
    where: { id: params.invoiceId },
    include: {
      account: { select: { id: true, name: true } },
      transactions: {
        orderBy: { date: 'desc' },
        select: {
          id: true, date: true, description: true, amount: true, type: true,
          installmentNumber: true, installmentTotal: true,
        },
      },
    },
  });

  if (!invoice) return { error: 'Invoice not found' };

  return {
    id: invoice.id,
    account: { id: invoice.account.id, name: invoice.account.name },
    referenceMonth: invoice.referenceMonth,
    referenceYear: invoice.referenceYear,
    closingDate: invoice.closingDate ? invoice.closingDate.toISOString().split('T')[0] : null,
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString().split('T')[0] : null,
    totalAmount: invoice.totalAmount,
    minimumPayment: invoice.minimumPayment,
    previousBalance: invoice.previousBalance,
    paidAmount: invoice.paidAmount,
    creditLimitSnapshot: invoice.creditLimitSnapshot,
    availableLimitSnapshot: invoice.availableLimitSnapshot,
    status: invoice.status,
    transactions: invoice.transactions.map((t) => ({
      id: t.id,
      date: t.date.toISOString().split('T')[0],
      description: t.description,
      amount: t.amount,
      type: t.type,
      installment:
        t.installmentNumber && t.installmentTotal
          ? `${t.installmentNumber}/${t.installmentTotal}`
          : null,
    })),
  };
}

export async function get_categories(_params: Record<string, never>) {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, color: true, icon: true, parentId: true, budget: true,
    },
  });
  return { categories };
}

export async function get_subscriptions(params: {
  inactive?: boolean;
  includeStats?: boolean;
}) {
  const where: Prisma.SubscriptionWhereInput = {};
  if (params.inactive !== undefined) where.inactive = params.inactive;

  const subscriptions = await prisma.subscription.findMany({
    where,
    orderBy: [{ inactive: 'asc' }, { nextPayment: 'asc' }],
    include: {
      category: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
    },
  });

  let stats = null;
  if (params.includeStats) {
    const active = subscriptions.filter((s) => !s.inactive);
    const totalMonthlyCost = active.reduce((sum, s) => {
      const monthly =
        s.billingCycle === 'YEARLY'
          ? s.price / 12
          : s.billingCycle === 'WEEKLY'
          ? s.price * 4.35
          : s.price;
      return sum + monthly;
    }, 0);
    stats = {
      activeCount: active.length,
      inactiveCount: subscriptions.length - active.length,
      totalMonthlyCost,
      totalYearlyCost: totalMonthlyCost * 12,
    };
  }

  return { subscriptions, stats };
}

export async function get_dashboard_summary(params: {
  dateFrom?: string;
  dateTo?: string;
}) {
  const where: Prisma.TransactionWhereInput = {};
  if (params.dateFrom || params.dateTo) {
    where.date = {
      ...(params.dateFrom && { gte: new Date(params.dateFrom) }),
      ...(params.dateTo && { lte: new Date(params.dateTo) }),
    };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    select: { type: true, amount: true, date: true },
  });

  const totalIncome = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + t.amount, 0);

  const monthlyMap = new Map<string, { income: number; expenses: number }>();
  for (const t of transactions) {
    const key = t.date.toISOString().slice(0, 7);
    const entry = monthlyMap.get(key) ?? { income: 0, expenses: 0 };
    if (t.type === 'INCOME') entry.income += t.amount;
    else if (t.type === 'EXPENSE') entry.expenses += t.amount;
    monthlyMap.set(key, entry);
  }

  const monthlyTrends = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data, net: data.income - data.expenses }));

  return {
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
    transactionCount: transactions.length,
    monthlyTrends,
  };
}

export async function get_category_breakdown(params: {
  dateFrom?: string;
  dateTo?: string;
  type?: 'INCOME' | 'EXPENSE';
}) {
  const where: Prisma.TransactionWhereInput = {
    type: params.type ?? 'EXPENSE',
  };
  if (params.dateFrom || params.dateTo) {
    where.date = {
      ...(params.dateFrom && { gte: new Date(params.dateFrom) }),
      ...(params.dateTo && { lte: new Date(params.dateTo) }),
    };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      amount: true,
      category: { select: { id: true, name: true, color: true } },
    },
  });

  const totals = new Map<string, { name: string; color: string; total: number; count: number }>();
  const grand = transactions.reduce((s, t) => s + t.amount, 0);

  for (const t of transactions) {
    const key = t.category?.id ?? '__uncategorized__';
    const existing = totals.get(key) ?? {
      name: t.category?.name ?? 'Uncategorized',
      color: t.category?.color ?? '#6B7280',
      total: 0,
      count: 0,
    };
    existing.total += t.amount;
    existing.count += 1;
    totals.set(key, existing);
  }

  return {
    type: params.type ?? 'EXPENSE',
    total: grand,
    categories: Array.from(totals.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        color: data.color,
        total: data.total,
        count: data.count,
        percentage: grand > 0 ? Math.round((data.total / grand) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total),
  };
}
