import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateTransactionUpdate, validateQueryParams, ValidationError } from '@/lib/validation';
import { amountEqualsRange, parseSearchAmount } from '@/lib/searchAmount';
import { expandCategoryIdsWithDescendants } from '@/lib/categoryDescendants';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const categoryId = searchParams.get('categoryId');
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Validate query parameters
    validateQueryParams({
      accountId,
      categoryId,
      type,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      limit,
      offset,
    });

    const where: Record<string, unknown> = {};

    if (accountId) where.accountId = accountId;
    if (categoryId) {
      const allCategories = await prisma.category.findMany({
        select: { id: true, parentId: true },
      });
      const expandedCategoryIds = expandCategoryIdsWithDescendants(allCategories, [categoryId]);
      where.categoryId = { in: expandedCategoryIds };
    }
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

    // Get total count for pagination
    const totalCount = await prisma.transaction.count({ where });

    // Apply pagination
    const pageLimit = limit ? parseInt(limit) : 50;
    const pageOffset = offset ? parseInt(offset) : 0;

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        account: { select: { name: true, color: true } },
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
      take: pageLimit,
      skip: pageOffset,
    });

    return NextResponse.json({
      transactions,
      pagination: {
        total: totalCount,
        limit: pageLimit,
        offset: pageOffset,
        hasMore: pageOffset + transactions.length < totalCount,
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, categoryId, description, notes } = body;

    // Validate input
    validateTransactionUpdate({ id, categoryId, description, notes });

    const data: Record<string, unknown> = {};
    if (categoryId !== undefined) data.categoryId = categoryId || null;
    if (description !== undefined) data.description = description;
    if (notes !== undefined) data.notes = notes || null;

    const transaction = await prisma.transaction.update({
      where: { id },
      data,
    });

    return NextResponse.json(transaction);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to update transaction:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}
