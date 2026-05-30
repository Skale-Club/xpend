import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withApiLogging } from '@/lib/apiLogger';

async function ensureGamesCategoryExists() {
  await prisma.$transaction(async (tx) => {
    let entertainment = await tx.category.findFirst({
      where: { name: 'Entertainment' },
      select: { id: true, color: true },
    });

    if (!entertainment) {
      const createdEntertainment = await tx.category.create({
        data: {
          name: 'Entertainment',
          color: '#F59E0B',
          icon: 'Film',
          isSystem: true,
        },
        select: { id: true, color: true },
      });
      entertainment = createdEntertainment;
    }

    const games = await tx.category.findFirst({
      where: { name: 'Games' },
      select: { id: true, parentId: true, color: true, icon: true },
    });

    if (!games) {
      await tx.category.create({
        data: {
          name: 'Games',
          color: entertainment.color,
          icon: 'Gamepad2',
          parentId: entertainment.id,
          isSystem: true,
        },
      });
      return;
    }

    if (
      games.parentId !== entertainment.id ||
      games.color !== entertainment.color ||
      games.icon !== 'Gamepad2'
    ) {
      await tx.category.update({
        where: { id: games.id },
        data: {
          parentId: entertainment.id,
          color: entertainment.color,
          icon: 'Gamepad2',
          isSystem: true,
        },
      });
    }
  });
}

export const GET = withApiLogging(async (request: Request) => {
  try {
    await ensureGamesCategoryExists();

    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });

    const { searchParams } = new URL(request.url);

    // Opt-in: attach a rolled-up `spent` figure per category for the given date
    // range. Gated behind `withSpending` so other consumers of this endpoint
    // (which just expect the plain category array) are unaffected.
    if (searchParams.get('withSpending')) {
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');
      const spendingType = searchParams.get('type') === 'INCOME' ? 'INCOME' : 'EXPENSE';
      const accountIds = searchParams
        .getAll('accountId')
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean);

      const where: Record<string, unknown> = { type: spendingType };
      if (dateFrom || dateTo) {
        const dateFilter: Record<string, Date> = {};
        if (dateFrom) dateFilter.gte = new Date(dateFrom);
        if (dateTo) dateFilter.lte = new Date(dateTo);
        where.date = dateFilter;
      }
      if (accountIds.length > 0) {
        where.accountId = { in: accountIds };
      }

      const grouped = await prisma.transaction.groupBy({
        by: ['categoryId'],
        where,
        _sum: { amount: true },
      });

      const ownSpent = new Map<string, number>();
      for (const row of grouped) {
        if (row.categoryId) ownSpent.set(row.categoryId, row._sum.amount ?? 0);
      }

      const childrenByParent = new Map<string, string[]>();
      for (const category of categories) {
        if (!category.parentId) continue;
        const siblings = childrenByParent.get(category.parentId) ?? [];
        siblings.push(category.id);
        childrenByParent.set(category.parentId, siblings);
      }

      // Roll each category's own spend up with all of its descendants'.
      const totalSpentCache = new Map<string, number>();
      const computeSpent = (id: string): number => {
        const cached = totalSpentCache.get(id);
        if (cached !== undefined) return cached;
        let total = ownSpent.get(id) ?? 0;
        for (const childId of childrenByParent.get(id) ?? []) {
          total += computeSpent(childId);
        }
        totalSpentCache.set(id, total);
        return total;
      };

      const withSpending = categories.map((category) => ({
        ...category,
        spent: computeSpent(category.id),
      }));
      return NextResponse.json(withSpending);
    }

    return NextResponse.json(categories);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
});

export const POST = withApiLogging(async (request: Request) => {
  try {
    const body = await request.json();

    let color = body.color || '#6B7280';
    const parentId = body.parentId || null;

    if (parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: parentId },
        select: { color: true },
      });

      if (!parent) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 400 });
      }

      // Subcategories always inherit parent color
      color = parent.color;
    }

    const category = await prisma.category.create({
      data: {
        name: body.name,
        color,
        icon: body.icon,
        parentId,
      },
    });
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
});
