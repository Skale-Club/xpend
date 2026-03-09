import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { amountEqualsRange, parseSearchAmount } from '@/lib/searchAmount';
import { expandCategoryIdsWithDescendants } from '@/lib/categoryDescendants';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const accountIds = searchParams.get('accountIds')?.split(',').filter(Boolean);
    const categoryIds = searchParams.get('categoryIds')?.split(',').filter(Boolean);
    const type = searchParams.get('type');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const search = searchParams.get('search');

    const allCategories = await prisma.category.findMany({
      select: { id: true, name: true, color: true, parentId: true },
    });

    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    const where: Record<string, unknown> = {};
    if (Object.keys(dateFilter).length > 0) where.date = dateFilter;
    if (accountIds && accountIds.length > 0) where.accountId = { in: accountIds };
    if (categoryIds && categoryIds.length > 0) {
      const expandedCategoryIds = expandCategoryIdsWithDescendants(allCategories, categoryIds);
      where.categoryId = { in: expandedCategoryIds };
    }
    if (type) where.type = type;
    
    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) (where.amount as Record<string, number>).gte = parseFloat(minAmount);
      if (maxAmount) (where.amount as Record<string, number>).lte = parseFloat(maxAmount);
    }
    
    if (search) {
      const amountFromSearch = parseSearchAmount(search);
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { category: { name: { contains: search, mode: 'insensitive' } } },
        { account: { name: { contains: search, mode: 'insensitive' } } },
        ...(amountFromSearch !== null ? [{ amount: amountEqualsRange(amountFromSearch) }] : []),
      ];
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        account: { select: { id: true, name: true, color: true, initialBalance: true } },
        category: { select: { id: true, name: true, color: true, icon: true, parentId: true } },
      },
      orderBy: { date: 'desc' },
    });

    const categoryContext = buildCategoryContext(allCategories);

    const totalIncome = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    // Pagination for recent transactions list
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const limit = limitParam ? parseInt(limitParam) : 10;
    const offset = offsetParam ? parseInt(offsetParam) : 0;
    const totalTransactions = transactions.length;
    const paginatedTransactions = transactions.slice(offset, offset + limit);

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
        date: true,
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

    const expenseCategoryData = getCategoryData(transactions, 'EXPENSE', categoryContext);
    const incomeCategoryData = getCategoryData(transactions, 'INCOME', categoryContext);
    const merchantData = getMerchantData(transactions);
    const accountDistribution = getAccountDistribution(transactions);
    const recurringVsOneTime = getRecurringVsOneTime(transactions);
    const weekdayPattern = getWeekdayPattern(transactions);
    const subcategoryData = getSubcategoryData(transactions, 'EXPENSE', categoryContext);
    const parentCategoryBreakdown = getParentCategoryBreakdown(transactions, 'EXPENSE', categoryContext);

    const balanceTrend = getBalanceTrend(accounts, transactions);
    const spendingPace = getSpendingPaceData(transactions);
    const cashFlowSummary = getCashFlowSummaryData(transactions);
    const netWorthSummary = getNetWorthSummaryData(accounts, allTransactions, balances);

    return NextResponse.json({
      totalIncome,
      totalExpenses,
      totalBalance: totalIncome - totalExpenses,
      transactionCount: totalTransactions,
      monthlyData,
      expenseCategoryData,
      incomeCategoryData,
      merchantData,
      accountDistribution,
      recurringVsOneTime,
      weekdayPattern,
      subcategoryData,
      parentCategoryBreakdown,
      balanceTrend,
      spendingPace,
      cashFlowSummary,
      netWorthSummary,
      balances,
      transactions: paginatedTransactions,
      pagination: {
        total: totalTransactions,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}

function buildCategoryContext(categories: { id: string; name: string; color: string; parentId: string | null }[]) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rootCache = new Map<string, string>();
  const firstChildCache = new Map<string, string | null>();
  const colorCache = new Map<string, string>();

  const getRootCategoryId = (categoryId: string): string => {
    if (rootCache.has(categoryId)) return rootCache.get(categoryId)!;

    let current = byId.get(categoryId);
    let rootId = categoryId;

    while (current?.parentId) {
      rootId = current.parentId;
      current = byId.get(current.parentId);
    }

    rootCache.set(categoryId, current?.id || rootId);
    return rootCache.get(categoryId)!;
  };

  const getFirstChildUnderRootId = (categoryId: string): string | null => {
    if (firstChildCache.has(categoryId)) return firstChildCache.get(categoryId)!;

    const rootId = getRootCategoryId(categoryId);
    let currentId = categoryId;
    let current = byId.get(currentId);

    if (!current || current.id === rootId) {
      firstChildCache.set(categoryId, null);
      return null;
    }

    while (current?.parentId && current.parentId !== rootId) {
      currentId = current.parentId;
      current = byId.get(current.parentId);
    }

    firstChildCache.set(categoryId, currentId);
    return currentId;
  };

  const getEffectiveColor = (categoryId: string): string => {
    if (colorCache.has(categoryId)) return colorCache.get(categoryId)!;

    let current = byId.get(categoryId);
    let color = current?.color || '#6B7280';

    // Subcategories inherit root color in charts for visual consistency.
    while (current?.parentId) {
      current = byId.get(current.parentId);
      if (current?.color) {
        color = current.color;
      }
    }

    colorCache.set(categoryId, color);
    return color;
  };

  return {
    byId,
    getRootCategoryId,
    getFirstChildUnderRootId,
    getEffectiveColor,
  };
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
  transactions: { type: string; amount: number; category: { id: string; name: string; color: string; parentId?: string | null } | null }[],
  filterType: string,
  categoryContext: ReturnType<typeof buildCategoryContext>
) {
  const categoryMap = new Map<string, { total: number; count: number; color: string; name: string }>();
  const filteredTxs = transactions.filter((t) => t.type === filterType);
  const totalAmount = filteredTxs.reduce((sum, t) => sum + t.amount, 0);

  for (const t of filteredTxs) {
    const key = t.category?.id ? categoryContext.getRootCategoryId(t.category.id) : 'uncategorized';
    const category = t.category?.id ? categoryContext.byId.get(key) : null;
    const name = category?.name || 'Uncategorized';
    const color = category?.color || '#6B7280';

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
      percentage: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

function getMerchantData(transactions: { type: string; amount: number; description: string }[]) {
  const merchantMap = new Map<string, { total: number; count: number; color: string; name: string }>();
  const expenses = transactions.filter((t) => t.type === 'EXPENSE');
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);

  // Define a consistent set of colors for merchants (matches Reports API)
  const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#6366F1', '#EC4899', '#14B8A6'];

  for (const t of expenses) {
    const name = t.description.trim().toUpperCase();

    if (!merchantMap.has(name)) {
      const colorIndex = merchantMap.size % colors.length;
      merchantMap.set(name, { total: 0, count: 0, color: colors[colorIndex], name });
    }

    const data = merchantMap.get(name)!;
    data.total += t.amount;
    data.count += 1;
  }

  return Array.from(merchantMap.entries())
    .map(([merchantId, data]) => ({
      categoryId: merchantId, // Keep for backward compatibility
      categoryName: data.name,
      color: data.color,
      total: data.total,
      percentage: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

function getAccountDistribution(
  transactions: { type: string; amount: number; account: { id: string; name: string; color: string } }[]
) {
  const accountMap = new Map<string, { total: number; count: number; color: string; name: string }>();
  const expenses = transactions.filter((t) => t.type === 'EXPENSE');
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);

  for (const t of expenses) {
    const key = t.account.id;
    const name = t.account.name;
    const color = t.account.color;

    if (!accountMap.has(key)) {
      accountMap.set(key, { total: 0, count: 0, color, name });
    }

    const data = accountMap.get(key)!;
    data.total += t.amount;
    data.count += 1;
  }

  return Array.from(accountMap.entries())
    .map(([accountId, data]) => ({
      categoryId: accountId,
      categoryName: data.name,
      color: data.color,
      total: data.total,
      percentage: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.total - a.total);
}

function getRecurringVsOneTime(transactions: { type: string; amount: number; isRecurring: boolean }[]) {
  const expenses = transactions.filter((t) => t.type === 'EXPENSE');
  const recurring = expenses.filter((t) => t.isRecurring);
  const oneTime = expenses.filter((t) => !t.isRecurring);

  const recurringTotal = recurring.reduce((sum, t) => sum + t.amount, 0);
  const oneTimeTotal = oneTime.reduce((sum, t) => sum + t.amount, 0);
  const total = recurringTotal + oneTimeTotal;

  return [
    {
      categoryId: 'recurring',
      categoryName: 'Recurring',
      color: '#F59E0B', // amber-500
      total: recurringTotal,
      percentage: total > 0 ? (recurringTotal / total) * 100 : 0,
      count: recurring.length,
    },
    {
      categoryId: 'one-time',
      categoryName: 'One-time',
      color: '#8B5CF6', // violet-500
      total: oneTimeTotal,
      percentage: total > 0 ? (oneTimeTotal / total) * 100 : 0,
      count: oneTime.length,
    },
  ].filter((item) => item.total > 0);
}

function getWeekdayPattern(transactions: { type: string; amount: number; date: Date }[]) {
  const weekdayMap = new Map<number, { total: number; count: number }>();
  const expenses = transactions.filter((t) => t.type === 'EXPENSE');
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);

  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekdayColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6366F1'];

  for (const t of expenses) {
    const date = new Date(t.date);
    const weekday = date.getDay();

    if (!weekdayMap.has(weekday)) {
      weekdayMap.set(weekday, { total: 0, count: 0 });
    }

    const data = weekdayMap.get(weekday)!;
    data.total += t.amount;
    data.count += 1;
  }

  return Array.from(weekdayMap.entries())
    .map(([weekday, data]) => ({
      categoryId: `weekday-${weekday}`,
      categoryName: weekdayNames[weekday],
      color: weekdayColors[weekday],
      total: data.total,
      percentage: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.total - a.total);
}

function getSubcategoryData(
  transactions: { type: string; amount: number; category: { id: string; name: string; color: string; parentId?: string | null } | null }[],
  filterType: string,
  categoryContext: ReturnType<typeof buildCategoryContext>
) {
  const subcategoryMap = new Map<string, { total: number; count: number; color: string; name: string; parentName?: string }>();
  const filteredTxs = transactions.filter((t) => t.type === filterType && t.category?.parentId); // Only subcategories
  const totalAmount = filteredTxs.reduce((sum, t) => sum + t.amount, 0);

  for (const t of filteredTxs) {
    if (!t.category) continue;

    const key = t.category.id;
    const name = t.category.name;
    const color = categoryContext.getEffectiveColor(t.category.id);
    const rootId = categoryContext.getRootCategoryId(t.category.id);
    const parentName = categoryContext.byId.get(rootId)?.name;

    if (!subcategoryMap.has(key)) {
      subcategoryMap.set(key, { total: 0, count: 0, color, name, parentName });
    }

    const data = subcategoryMap.get(key)!;
    data.total += t.amount;
    data.count += 1;
  }

  return Array.from(subcategoryMap.entries())
    .map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.parentName ? `${data.parentName} - ${data.name}` : data.name,
      color: data.color,
      total: data.total,
      percentage: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

function getParentCategoryBreakdown(
  transactions: { type: string; amount: number; category: { id: string; name: string; color: string; parentId?: string | null } | null }[],
  filterType: string,
  categoryContext: ReturnType<typeof buildCategoryContext>
) {
  const parentMap = new Map<
    string,
    {
      parentId: string;
      parentName: string;
      parentColor: string;
      total: number;
      subMap: Map<string, { id: string; name: string; color: string; total: number; count: number }>;
    }
  >();

  const filteredTxs = transactions.filter((t) => t.type === filterType && t.category?.id);

  for (const t of filteredTxs) {
    if (!t.category?.id) continue;
    const rootId = categoryContext.getRootCategoryId(t.category.id);
    const root = categoryContext.byId.get(rootId);
    if (!root) continue;

    if (!parentMap.has(rootId)) {
      parentMap.set(rootId, {
        parentId: rootId,
        parentName: root.name,
        parentColor: root.color,
        total: 0,
        subMap: new Map(),
      });
    }

    const parentEntry = parentMap.get(rootId)!;
    parentEntry.total += t.amount;

    const segmentId = categoryContext.getFirstChildUnderRootId(t.category.id) || t.category.id;
    const segmentCategory = categoryContext.byId.get(segmentId);
    const segmentName = segmentCategory?.name || t.category.name;
    const segmentColor = segmentCategory?.id
      ? categoryContext.getEffectiveColor(segmentCategory.id)
      : categoryContext.getEffectiveColor(t.category.id);

    if (!parentEntry.subMap.has(segmentId)) {
      parentEntry.subMap.set(segmentId, {
        id: segmentId,
        name: segmentName,
        color: segmentColor,
        total: 0,
        count: 0,
      });
    }

    const segment = parentEntry.subMap.get(segmentId)!;
    segment.total += t.amount;
    segment.count += 1;
  }

  return Array.from(parentMap.values())
    .map((parent) => ({
      parentId: parent.parentId,
      parentName: parent.parentName,
      parentColor: parent.parentColor,
      total: parent.total,
      subcategories: Array.from(parent.subMap.values())
        .sort((a, b) => b.total - a.total)
        .map((sub) => ({
          categoryId: sub.id,
          categoryName: sub.name,
          color: sub.color,
          total: sub.total,
          percentage: parent.total > 0 ? (sub.total / parent.total) * 100 : 0,
          count: sub.count,
        })),
    }))
    .filter((parent) => parent.subcategories.length > 0)
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

function getSpendingPaceData(transactions: { date: Date; type: string; amount: number }[]) {
  const { currentMonthDate, previousMonthDate } = getLatestClosedMonthPair();

  const currentYear = currentMonthDate.getFullYear();
  const currentMonth = currentMonthDate.getMonth();
  const previousYear = previousMonthDate.getFullYear();
  const previousMonth = previousMonthDate.getMonth();

  const currentMonthDays = new Date(currentYear, currentMonth + 1, 0).getDate();
  const previousMonthDays = new Date(previousYear, previousMonth + 1, 0).getDate();

  const currentDailyTotals = Array.from({ length: currentMonthDays + 1 }, () => 0);
  const previousDailyTotals = Array.from({ length: previousMonthDays + 1 }, () => 0);

  for (const transaction of transactions) {
    if (transaction.type !== 'EXPENSE') continue;

    const transactionDate = new Date(transaction.date);
    const day = transactionDate.getDate();
    const year = transactionDate.getFullYear();
    const month = transactionDate.getMonth();

    if (year === currentYear && month === currentMonth) {
      currentDailyTotals[day] += transaction.amount;
    } else if (year === previousYear && month === previousMonth) {
      previousDailyTotals[day] += transaction.amount;
    }
  }

  const currentCumulative = Array.from({ length: currentMonthDays + 1 }, () => 0);
  const previousCumulative = Array.from({ length: previousMonthDays + 1 }, () => 0);

  for (let day = 1; day <= currentMonthDays; day += 1) {
    currentCumulative[day] = currentCumulative[day - 1] + currentDailyTotals[day];
  }

  for (let day = 1; day <= previousMonthDays; day += 1) {
    previousCumulative[day] = previousCumulative[day - 1] + previousDailyTotals[day];
  }

  const maxDays = Math.max(currentMonthDays, previousMonthDays);
  const currentComparableDay = currentMonthDays;
  const previousComparableDay = previousMonthDays;

  const currentTotal = currentCumulative[currentComparableDay] || 0;
  const previousComparableTotal = previousCumulative[previousComparableDay] || 0;
  const previousMonthTotal = previousCumulative[previousMonthDays] || 0;

  const changePercentage =
    previousComparableTotal > 0
      ? ((currentTotal - previousComparableTotal) / previousComparableTotal) * 100
      : currentTotal === 0
        ? 0
        : null;

  const status =
    currentTotal < previousComparableTotal
      ? 'below'
      : currentTotal > previousComparableTotal
        ? 'above'
        : 'equal';

  const chartData = Array.from({ length: maxDays }, (_, index) => {
    const day = index + 1;
    return {
      day,
      currentMonth: day <= currentMonthDays ? currentCumulative[day] || 0 : null,
      previousMonth: day <= previousMonthDays ? previousCumulative[day] || 0 : null,
    };
  });

  const currentMonthLabel = currentMonthDate.toLocaleString('default', { month: 'short', year: 'numeric' });
  const previousMonthLabel = previousMonthDate.toLocaleString('default', { month: 'short', year: 'numeric' });

  return {
    currentTotal,
    previousComparableTotal,
    previousMonthTotal,
    changePercentage,
    status,
    currentComparableDay,
    currentMonthLabel,
    previousMonthLabel,
    chartData,
  };
}

function getLatestClosedMonthPair() {
  const now = new Date();

  return {
    currentMonthDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    previousMonthDate: new Date(now.getFullYear(), now.getMonth() - 2, 1),
  };
}

function getCashFlowSummaryData(transactions: { date: Date; type: string; amount: number }[]) {
  const { currentMonthDate, previousMonthDate } = getLatestClosedMonthPair();
  const currentYear = currentMonthDate.getFullYear();
  const currentMonth = currentMonthDate.getMonth();
  const previousYear = previousMonthDate.getFullYear();
  const previousMonth = previousMonthDate.getMonth();

  let currentIncome = 0;
  let currentExpense = 0;
  let currentTransfer = 0;
  let previousNet = 0;

  for (const transaction of transactions) {
    const txDate = new Date(transaction.date);
    const year = txDate.getFullYear();
    const month = txDate.getMonth();

    if (year === currentYear && month === currentMonth) {
      if (transaction.type === 'INCOME') currentIncome += transaction.amount;
      if (transaction.type === 'EXPENSE') currentExpense += transaction.amount;
      if (transaction.type === 'TRANSFER') currentTransfer += transaction.amount;
      continue;
    }

    if (year === previousYear && month === previousMonth) {
      if (transaction.type === 'INCOME') previousNet += transaction.amount;
      if (transaction.type === 'EXPENSE') previousNet -= transaction.amount;
    }
  }

  const currentNet = currentIncome - currentExpense;
  const changePercentage =
    previousNet !== 0
      ? ((currentNet - previousNet) / Math.abs(previousNet)) * 100
      : currentNet === 0
        ? 0
        : null;

  return {
    currentMonthLabel: currentMonthDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
    previousMonthLabel: previousMonthDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
    netAmount: currentNet,
    previousNetAmount: previousNet,
    incomeAmount: currentIncome,
    expenseAmount: currentExpense,
    transferAmount: currentTransfer,
    changePercentage,
  };
}

function getNetWorthSummaryData(
  accounts: { id: string; initialBalance: number }[],
  allTransactions: { accountId: string; type: string; amount: number; date: Date }[],
  balances: Record<string, number>
) {
  const netWorth = Object.values(balances).reduce((sum, value) => sum + value, 0);
  const initialTotal = accounts.reduce((sum, account) => sum + account.initialBalance, 0);
  const sortedTransactions = [...allTransactions].sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstTransactionDate = sortedTransactions[0]?.date ?? null;

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 6);
  startDate.setHours(0, 0, 0, 0);

  const dailyDelta = new Map<string, number>();
  let runningBalance = initialTotal;
  const series: { label: string; value: number }[] = [];

  for (const transaction of sortedTransactions) {
    const date = new Date(transaction.date);
    const dayKey = date.toISOString().slice(0, 10);
    const currentDelta = dailyDelta.get(dayKey) || 0;
    const delta = transaction.type === 'INCOME' ? transaction.amount : transaction.type === 'EXPENSE' ? -transaction.amount : 0;
    dailyDelta.set(dayKey, currentDelta + delta);
  }

  const baselineDate = new Date(startDate);
  baselineDate.setDate(startDate.getDate() - 1);
  for (const transaction of sortedTransactions) {
    if (transaction.date > baselineDate) break;
    if (transaction.type === 'INCOME') runningBalance += transaction.amount;
    if (transaction.type === 'EXPENSE') runningBalance -= transaction.amount;
  }

  for (let i = 0; i < 7; i += 1) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    const key = day.toISOString().slice(0, 10);
    runningBalance += dailyDelta.get(key) || 0;

    series.push({
      label: day.toLocaleDateString('en-US', { weekday: 'short' }),
      value: runningBalance,
    });
  }

  const daysTracked = firstTransactionDate
    ? Math.floor((now.getTime() - firstTransactionDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  return {
    netWorth,
    daysTracked,
    hasEnoughHistory: daysTracked >= 7,
    series,
  };
}

