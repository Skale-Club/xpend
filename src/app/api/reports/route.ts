import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateQueryParams, ValidationError } from '@/lib/validation';
import type { TransactionType } from '@/types';
import { amountEqualsRange, parseSearchAmount } from '@/lib/searchAmount';
import { expandCategoryIdsWithDescendants } from '@/lib/categoryDescendants';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const accountIds = searchParams.get('accountIds')?.split(',').filter(Boolean);
    const categoryIds = searchParams.get('categoryIds')?.split(',').filter(Boolean);
    const type = searchParams.get('type') || 'EXPENSE'; // Default to analyzing expenses
    const search = searchParams.get('search');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');

    validateQueryParams({
      dateFrom,
      dateTo,
      type,
      minAmount,
      maxAmount
    });

    const allCategories = await prisma.category.findMany();

    const where: Record<string, unknown> = {};
    if (type) where.type = type;

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) (where.date as Record<string, Date>).gte = new Date(dateFrom);
      if (dateTo) (where.date as Record<string, Date>).lte = new Date(dateTo);
    }

    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) (where.amount as Record<string, number>).gte = parseFloat(minAmount);
      if (maxAmount) (where.amount as Record<string, number>).lte = parseFloat(maxAmount);
    }

    if (accountIds && accountIds.length > 0) {
      where.accountId = { in: accountIds };
    }

    if (categoryIds && categoryIds.length > 0) {
      const expandedCategoryIds = expandCategoryIdsWithDescendants(
        allCategories.map((category) => ({ id: category.id, parentId: category.parentId })),
        categoryIds
      );
      where.categoryId = { in: expandedCategoryIds };
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
        category: { select: { id: true, name: true, color: true, icon: true } },
        account: { select: { id: true, name: true, color: true } },
      },
      orderBy: { date: 'desc' },
    });

    // 1. Summary
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const transactionCount = transactions.length;
    const averageAmount = transactionCount > 0 ? totalAmount / transactionCount : 0;

    // 2. Time Series (Daily or Monthly based on range)
    const isLongRange = dateFrom && dateTo && (new Date(dateTo).getTime() - new Date(dateFrom).getTime() > 1000 * 60 * 60 * 24 * 60); // > 60 days
    const timeMap = new Map<string, number>();

    for (const t of transactions) {
      const date = new Date(t.date);
      let key = '';
      if (isLongRange) {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
      timeMap.set(key, (timeMap.get(key) || 0) + t.amount);
    }

    const timeSeries = Array.from(timeMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount }));

    // 3. Category Breakdown (Hierarchical)
    const categoriesMap = new Map(allCategories.map(c => [c.id, c]));

    // Map to hold nodes. Key is category id (or 'uncategorized')
    const nodeMap = new Map<string, any>();

    // Helper to get or create a node
    const getOrCreateNode = (id: string, name: string, color: string) => {
      if (!nodeMap.has(id)) {
        nodeMap.set(id, { id, name, color, amount: 0, count: 0, transactions: [], subcategories: [] });
      }
      return nodeMap.get(id)!;
    };

    // First pass: attach transactions to their specific category node
    for (const t of transactions) {
      const catId = t.category?.id || 'uncategorized';
      const catName = t.category?.name || 'Uncategorized';
      const catColor = t.category?.color || '#9CA3AF';

      const node = getOrCreateNode(catId, catName, catColor);
      node.amount += t.amount;
      node.count += 1;
      node.transactions.push({
        id: t.id,
        description: t.description,
        amount: t.amount,
        date: t.date,
        type: t.type,
        category: t.category
          ? {
            id: t.category.id,
            name: t.category.name,
            color: t.category.color,
            icon: t.category.icon,
          }
          : null,
      });
    }

    // Sort transactions within each node
    for (const node of nodeMap.values()) {
      node.transactions.sort((a: any, b: any) => b.amount - a.amount);
    }

    // Second pass: build hierarchy and bubble up totals
    const rootNodes: any[] = [];

    // Process categories (that we actually have in the nodeMap or in allCategories)
    // We need to iterate over all nodes we created and put them in their parent
    // Wait, if a parent has no direct transactions, it might not be in nodeMap yet.
    // Let's create nodes for all categories that are ancestors of our active nodes.

    // Build set of all required category IDs
    const requiredCategoryIds = new Set<string>();
    for (const catId of nodeMap.keys()) {
      if (catId === 'uncategorized') continue;
      let currentId = catId;
      while (currentId) {
        requiredCategoryIds.add(currentId);
        const cat = categoriesMap.get(currentId);
        if (cat?.parentId) {
          currentId = cat.parentId;
        } else {
          break;
        }
      }
    }

    // Ensure all required nodes exist
    for (const catId of requiredCategoryIds) {
      const cat = categoriesMap.get(catId);
      if (cat && !nodeMap.has(catId)) {
        getOrCreateNode(catId, cat.name, cat.color);
      }
    }

    // Now build the tree and bubble up amounts/counts
    // To bubble up correctly, we need to process bottom-up. But simpler: just attach to parents.
    // Since amount/count includes children, we will recursively calculate later.
    for (const node of nodeMap.values()) {
      if (node.id === 'uncategorized') {
        rootNodes.push(node);
        continue;
      }
      const cat = categoriesMap.get(node.id);
      if (cat?.parentId && nodeMap.has(cat.parentId)) {
        const parentNode = nodeMap.get(cat.parentId)!;
        parentNode.subcategories.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    // Recursive function to calculate totals and percentages
    const calculateTotals = (node: any) => {
      let totalAmount = node.transactions.reduce((sum: number, t: any) => sum + t.amount, 0);
      let totalCount = node.transactions.length;

      for (const sub of node.subcategories) {
        calculateTotals(sub);
        totalAmount += sub.amount;
        totalCount += sub.count;
      }

      node.amount = totalAmount;
      node.count = totalCount;
      node.percentage = totalAmount > 0 ? (node.amount / (totalAmount > 0 ? totalAmount : 1)) : 0; // Temp percentage

      // Sort subcategories by amount
      node.subcategories.sort((a: any, b: any) => b.amount - a.amount);
    };

    for (const root of rootNodes) {
      calculateTotals(root);
    }

    // Now set the correct percentages based on the GLOBAL totalAmount
    const setPercentages = (node: any) => {
      node.percentage = totalAmount > 0 ? (node.amount / totalAmount) * 100 : 0;
      for (const sub of node.subcategories) {
        setPercentages(sub);
      }
    };

    for (const root of rootNodes) {
      setPercentages(root);
    }

    const categoryBreakdown = rootNodes
      .filter(node => node.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    // 4. Merchant Breakdown (by description)
    // Define consistent colors for merchants (matches Dashboard API)
    const merchantColors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#6366F1', '#EC4899', '#14B8A6'];

    const merchantMap = new Map<string, {
      total: number;
      count: number;
      transactionIds: string[];
      uncategorizedCount: number;
      typeCounts: Map<'INCOME' | 'EXPENSE' | 'TRANSFER', number>;
      categoryMap: Map<string, {
        category: { id: string; name: string; color: string; icon: string | null };
        count: number;
      }>;
    }>();

    for (const t of transactions) {
      // Very simple normalization for merchants
      const merchant = t.description.trim().toUpperCase();
      if (!merchantMap.has(merchant)) {
        merchantMap.set(merchant, {
          total: 0,
          count: 0,
          transactionIds: [],
          uncategorizedCount: 0,
          typeCounts: new Map(),
          categoryMap: new Map(),
        });
      }
      const data = merchantMap.get(merchant)!;
      data.total += t.amount;
      data.count += 1;
      data.transactionIds.push(t.id);
      data.typeCounts.set(t.type, (data.typeCounts.get(t.type) || 0) + 1);

      if (t.category?.id) {
        if (!data.categoryMap.has(t.category.id)) {
          data.categoryMap.set(t.category.id, {
            category: t.category,
            count: 0,
          });
        }
        data.categoryMap.get(t.category.id)!.count += 1;
      } else {
        data.uncategorizedCount += 1;
      }
    }

    const merchantBreakdown = Array.from(merchantMap.entries())
      .map(([name, data], index) => {
        const primaryCategoryEntry = Array.from(data.categoryMap.values())
          .sort((a, b) => b.count - a.count)[0];
        const sortedTypeCounts = Array.from(data.typeCounts.entries()).sort((a, b) => b[1] - a[1]);
        const transactionType =
          sortedTypeCounts.length === 1
            ? sortedTypeCounts[0][0]
            : sortedTypeCounts.length > 1 && sortedTypeCounts[0][1] > sortedTypeCounts[1][1]
              ? sortedTypeCounts[0][0]
              : null;

        const primaryCategory =
          primaryCategoryEntry && primaryCategoryEntry.count >= data.uncategorizedCount
            ? primaryCategoryEntry.category
            : null;

        // Assign consistent color: use primary category color or fall back to merchant color palette
        const color = primaryCategory?.color || merchantColors[index % merchantColors.length];

        return {
          name,
          amount: data.total,
          count: data.count,
          percentage: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0,
          transactionIds: data.transactionIds,
          transactionType,
          primaryCategory,
          color, // Add color field for consistency with Dashboard
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 50); // Top 50 merchants

    // 5. Account Distribution
    const accountDistribution = getAccountDistribution(transactions);

    // 6. Recurring vs One-time
    const recurringVsOneTime = getRecurringVsOneTime(transactions);

    // 7. Weekday Pattern
    const weekdayPattern = getWeekdayPattern(transactions);

    // 8. Subcategory Data (flatten to show only leaf categories)
    const subcategoryData = getSubcategoryData(categoryBreakdown);

    // 9. Largest Transactions
    const largestTransactions = [...transactions]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        description: t.description,
        amount: t.amount,
        date: t.date,
        type: t.type as TransactionType,
        category: t.category,
        account: t.account,
      }));

    return NextResponse.json({
      summary: { totalAmount, transactionCount, averageAmount },
      timeSeries,
      categoryBreakdown,
      merchantBreakdown,
      accountDistribution,
      recurringVsOneTime,
      weekdayPattern,
      subcategoryData,
      largestTransactions,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Reports API error:', error);
    return NextResponse.json({ error: 'Failed to fetch report data' }, { status: 500 });
  }
}

// Helper functions for additional visualizations
function getAccountDistribution(
  transactions: { type: string; amount: number; account: { id: string; name: string; color: string } | null }[]
) {
  const accountMap = new Map<string, { total: number; count: number; name: string; color: string }>();
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  for (const t of transactions) {
    if (!t.account) continue;
    const key = t.account.id;
    const name = t.account.name;
    const color = t.account.color;

    if (!accountMap.has(key)) {
      accountMap.set(key, { total: 0, count: 0, name, color });
    }

    const data = accountMap.get(key)!;
    data.total += t.amount;
    data.count += 1;
  }

  return Array.from(accountMap.entries())
    .map(([, data]) => ({
      name: data.name,
      amount: data.total,
      color: data.color,
      count: data.count,
      percentage: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function getRecurringVsOneTime(transactions: { amount: number; isRecurring: boolean }[]) {
  const recurring = transactions.filter((t) => t.isRecurring);
  const oneTime = transactions.filter((t) => !t.isRecurring);

  const recurringTotal = recurring.reduce((sum, t) => sum + t.amount, 0);
  const oneTimeTotal = oneTime.reduce((sum, t) => sum + t.amount, 0);
  const total = recurringTotal + oneTimeTotal;

  return [
    {
      name: 'Recurring',
      amount: recurringTotal,
      color: '#F59E0B', // amber-500
      count: recurring.length,
      percentage: total > 0 ? (recurringTotal / total) * 100 : 0,
    },
    {
      name: 'One-time',
      amount: oneTimeTotal,
      color: '#8B5CF6', // violet-500
      count: oneTime.length,
      percentage: total > 0 ? (oneTimeTotal / total) * 100 : 0,
    },
  ].filter((item) => item.amount > 0);
}

function getWeekdayPattern(transactions: { amount: number; date: Date }[]) {
  const weekdayMap = new Map<number, { total: number; count: number }>();
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekdayColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6366F1'];

  for (const t of transactions) {
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
      name: weekdayNames[weekday],
      amount: data.total,
      color: weekdayColors[weekday],
      count: data.count,
      percentage: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function getSubcategoryData(categoryBreakdown: any[]) {
  const subcategories: any[] = [];

  function extractSubcategories(node: any) {
    if (node.subcategories && node.subcategories.length > 0) {
      for (const sub of node.subcategories) {
        subcategories.push({
          name: sub.name,
          amount: sub.amount,
          color: sub.color,
          count: sub.count,
          percentage: sub.percentage,
        });
        extractSubcategories(sub); // Recursively extract nested subcategories
      }
    }
  }

  for (const category of categoryBreakdown) {
    extractSubcategories(category);
  }

  return subcategories.sort((a, b) => b.amount - a.amount).slice(0, 10);
}
