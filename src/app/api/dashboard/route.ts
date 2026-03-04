import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const accountIds = searchParams.get('accountIds')?.split(',').filter(Boolean);

    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    const where: Record<string, unknown> = {};
    if (Object.keys(dateFilter).length > 0) where.date = dateFilter;
    if (accountIds && accountIds.length > 0) where.accountId = { in: accountIds };

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        account: { select: { id: true, name: true, color: true, initialBalance: true } },
        category: { select: { id: true, name: true, color: true } },
      },
      orderBy: { date: 'desc' },
    });

    const totalIncome = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    // Optimize: Get accounts and calculate balances in a single query
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    // Get all transactions grouped by account in a single query
    const allTransactions = await prisma.transaction.findMany({
      where: {
        accountId: { in: accounts.map((a) => a.id) },
      },
      select: {
        accountId: true,
        type: true,
        amount: true,
      },
    });

    // Calculate balances efficiently
    const balances: Record<string, number> = {};
    for (const account of accounts) {
      const accountTxs = allTransactions.filter((t) => t.accountId === account.id);
      const income = accountTxs
        .filter((t) => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = accountTxs
        .filter((t) => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);

      balances[account.id] = account.initialBalance + income - expenses;
    }

    const monthlyData = getMonthlyData(transactions);

    const categoryData = getCategoryData(transactions);

    const balanceTrend = getBalanceTrend(accounts, transactions);

    return NextResponse.json({
      totalIncome,
      totalExpenses,
      totalBalance: totalIncome - totalExpenses,
      transactionCount: transactions.length,
      monthlyData,
      categoryData,
      balanceTrend,
      balances,
      transactions: transactions.slice(0, 50),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}

function getMonthlyData(transactions: { date: Date; type: string; amount: number }[]) {
  const monthlyMap = new Map<string, { income: number; expenses: number }>();

  for (const t of transactions) {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { income: 0, expenses: 0 });
    }

    const data = monthlyMap.get(key)!;
    if (t.type === 'INCOME') {
      data.income += t.amount;
    } else if (t.type === 'EXPENSE') {
      data.expenses += t.amount;
    }
  }

  return Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => {
      const [year, month] = key.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', {
        month: 'short',
      });
      return {
        month: monthName,
        year: parseInt(year),
        income: data.income,
        expenses: data.expenses,
        balance: data.income - data.expenses,
      };
    });
}

function getCategoryData(
  transactions: { type: string; amount: number; category: { id: string; name: string; color: string } | null }[]
) {
  const categoryMap = new Map<string, { total: number; count: number; color: string; name: string }>();
  const expenses = transactions.filter((t) => t.type === 'EXPENSE');
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);

  for (const t of expenses) {
    const key = t.category?.id || 'uncategorized';
    const name = t.category?.name || 'Uncategorized';
    const color = t.category?.color || '#6B7280';

    if (!categoryMap.has(key)) {
      categoryMap.set(key, { total: 0, count: 0, color, name });
    }

    const data = categoryMap.get(key)!;
    data.total += t.amount;
    data.count += 1;
  }

  return Array.from(categoryMap.entries())
    .map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      color: data.color,
      total: data.total,
      percentage: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.total - a.total);
}

function getBalanceTrend(
  accounts: { id: string; initialBalance: number }[],
  transactions: { accountId: string; date: Date; type: string; amount: number }[]
) {
  const monthlyBalances = new Map<string, number>();
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const initialTotal = accounts.reduce((sum, a) => sum + a.initialBalance, 0);

  let runningBalance = initialTotal;

  for (const t of sortedTransactions) {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (t.type === 'INCOME') {
      runningBalance += t.amount;
    } else if (t.type === 'EXPENSE') {
      runningBalance -= t.amount;
    }

    monthlyBalances.set(key, runningBalance);
  }

  return Array.from(monthlyBalances.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, balance]) => {
      const [year, month] = key.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', {
        month: 'short',
      });
      return {
        month: `${monthName} ${year}`,
        balance,
      };
    });
}
