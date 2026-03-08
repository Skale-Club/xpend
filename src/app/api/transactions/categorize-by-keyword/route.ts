import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { learnFromCorrection } from '@/lib/autoCategorize';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
    const categoryId = body.categoryId || null;
    const transactionId = typeof body.transactionId === 'string' ? body.transactionId : null;

    if (!keyword || keyword.length < 2) {
      return NextResponse.json({ error: 'Keyword must be at least 2 characters' }, { status: 400 });
    }

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const sourceTransaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true, type: true },
    });

    if (!sourceTransaction) {
      return NextResponse.json({ error: 'Source transaction not found' }, { status: 404 });
    }

    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });

      if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
    }

    const updated = await prisma.transaction.updateMany({
      where: {
        type: sourceTransaction.type,
        OR: [
          { id: sourceTransaction.id },
          { description: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      data: {
        categoryId,
      },
    });

    if (categoryId) {
      await learnFromCorrection(keyword, categoryId);
    }

    return NextResponse.json({
      success: true,
      updatedCount: updated.count,
      keyword,
    });
  } catch (error) {
    console.error('Failed to categorize by keyword:', error);
    return NextResponse.json({ error: 'Failed to categorize transactions by keyword' }, { status: 500 });
  }
}
