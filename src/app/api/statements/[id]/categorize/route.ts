import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { autoCategorize } from '@/lib/autoCategorize';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get all uncategorized transactions for this statement
    const transactions = await prisma.transaction.findMany({
      where: {
        statementId: id,
        categoryId: null, // Only categorize uncategorized transactions
      },
      select: {
        id: true,
        description: true,
        amount: true,
      },
    });

    if (transactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All transactions already categorized',
        categorizedCount: 0,
      });
    }

    let categorizedCount = 0;

    // Categorize each transaction
    for (const transaction of transactions) {
      const result = await autoCategorize(
        transaction.description,
        transaction.amount
      );

      if (result.categoryId) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { categoryId: result.categoryId },
        });
        categorizedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully categorized ${categorizedCount} out of ${transactions.length} transactions`,
      categorizedCount,
      totalTransactions: transactions.length,
    });
  } catch (error) {
    console.error('Failed to auto-categorize statement:', error);
    return NextResponse.json(
      { error: 'Failed to auto-categorize statement' },
      { status: 500 }
    );
  }
}
