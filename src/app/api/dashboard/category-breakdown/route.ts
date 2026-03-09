import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { amountEqualsRange, parseSearchAmount } from '@/lib/searchAmount';
import { expandCategoryIdsWithDescendants } from '@/lib/categoryDescendants';

type RawCategory = { id: string; name: string; color: string; parentId: string | null };

function buildCategoryContext(categories: RawCategory[]) {
  const byId = new Map(categories.map((category) => [category.id, category]));
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

    while (current?.parentId) {
      current = byId.get(current.parentId);
      if (current?.color) color = current.color;
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parentCategoryId = searchParams.get('parentCategoryId');

    if (!parentCategoryId) {
      return NextResponse.json({ error: 'parentCategoryId is required' }, { status: 400 });
    }

    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const accountIds = searchParams.get('accountIds')?.split(',').filter(Boolean);
    const categoryIds = searchParams.get('categoryIds')?.split(',').filter(Boolean);
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const search = searchParams.get('search');

    const allCategories = await prisma.category.findMany({
      select: { id: true, name: true, color: true, parentId: true },
    });
    const categoryContext = buildCategoryContext(allCategories);
    const parentCategory = categoryContext.byId.get(parentCategoryId);

    if (!parentCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    const where: Record<string, unknown> = { type: 'EXPENSE' };
    if (Object.keys(dateFilter).length > 0) where.date = dateFilter;
    if (accountIds && accountIds.length > 0) where.accountId = { in: accountIds };
    if (categoryIds && categoryIds.length > 0) {
      const expandedCategoryIds = expandCategoryIdsWithDescendants(allCategories, categoryIds);
      where.categoryId = { in: expandedCategoryIds };
    }

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
        account: { select: { id: true, name: true, color: true } },
        category: { select: { id: true, name: true, color: true, icon: true, parentId: true } },
      },
      orderBy: { date: 'desc' },
    });

    const scopedTransactions = transactions.filter((transaction) => {
      if (!transaction.category?.id) return false;
      return categoryContext.getRootCategoryId(transaction.category.id) === parentCategoryId;
    });

    const totalAmount = scopedTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);

    const subcategoryMap = new Map<
      string,
      { id: string; name: string; color: string; total: number; count: number }
    >();

    for (const transaction of scopedTransactions) {
      if (!transaction.category?.id) continue;

      const subcategoryId =
        categoryContext.getFirstChildUnderRootId(transaction.category.id) || transaction.category.id;
      const subcategory = categoryContext.byId.get(subcategoryId);
      const subcategoryName = subcategory?.name || transaction.category.name;
      const subcategoryColor = subcategory?.id
        ? categoryContext.getEffectiveColor(subcategory.id)
        : categoryContext.getEffectiveColor(transaction.category.id);

      if (!subcategoryMap.has(subcategoryId)) {
        subcategoryMap.set(subcategoryId, {
          id: subcategoryId,
          name: subcategoryName,
          color: subcategoryColor,
          total: 0,
          count: 0,
        });
      }

      const subcategoryData = subcategoryMap.get(subcategoryId)!;
      subcategoryData.total += transaction.amount;
      subcategoryData.count += 1;
    }

    const subcategories = Array.from(subcategoryMap.values())
      .sort((a, b) => b.total - a.total)
      .map((subcategory) => ({
        ...subcategory,
        percentage: totalAmount > 0 ? (subcategory.total / totalAmount) * 100 : 0,
      }));

    const transactionsLimit = 100;
    const serializedTransactions = scopedTransactions.slice(0, transactionsLimit).map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      description: transaction.description,
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      account: transaction.account,
      subcategoryName: transaction.category?.id
        ? categoryContext.byId.get(
            categoryContext.getFirstChildUnderRootId(transaction.category.id) || transaction.category.id
          )?.name || transaction.category.name
        : 'Uncategorized',
    }));

    return NextResponse.json({
      category: {
        id: parentCategory.id,
        name: parentCategory.name,
        color: parentCategory.color,
        total: totalAmount,
        count: scopedTransactions.length,
      },
      subcategories,
      transactions: serializedTransactions,
      totalTransactions: scopedTransactions.length,
      truncated: scopedTransactions.length > transactionsLimit,
    });
  } catch (error) {
    console.error('Dashboard category breakdown error:', error);
    return NextResponse.json({ error: 'Failed to fetch category breakdown' }, { status: 500 });
  }
}
