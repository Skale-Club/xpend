import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withApiLogging } from '@/lib/apiLogger';

export const GET = withApiLogging(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const year = searchParams.get('year');

    const where: { accountId?: string; year?: number } = {};
    if (accountId) where.accountId = accountId;
    if (year) where.year = parseInt(year, 10);

    const statements = await prisma.statement.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        account: {
          select: { name: true, type: true },
        },
        _count: {
          select: { transactions: true },
        },
      },
    });

    // Count uncategorized (categoryId = null) transactions per statement so the
    // UI can decide whether the one-time "Auto-categorize with AI" action still
    // has anything to do.
    const uncategorizedByStatement = new Map<string, number>();
    if (statements.length > 0) {
      const grouped = await prisma.transaction.groupBy({
        by: ['statementId'],
        where: {
          statementId: { in: statements.map((s) => s.id) },
          categoryId: null,
        },
        _count: { _all: true },
      });
      for (const row of grouped) {
        if (row.statementId) uncategorizedByStatement.set(row.statementId, row._count._all);
      }
    }

    // Transform to include hasTransactions flag
    const transformedStatements = statements.map((statement) => ({
      id: statement.id,
      accountId: statement.accountId,
      account: statement.account,
      month: statement.month,
      year: statement.year,
      fileName: statement.fileName,
      fileUrl: statement.fileUrl,
      uploadedAt: statement.uploadedAt,
      hasTransactions: statement._count.transactions > 0,
      transactionCount: statement._count.transactions,
      uncategorizedCount: uncategorizedByStatement.get(statement.id) ?? 0,
      aiCategorized: statement.aiCategorizedAt != null,
    }));

    return NextResponse.json(transformedStatements);
  } catch (error) {
    console.error('Failed to fetch statements:', error);
    return NextResponse.json({ error: 'Failed to fetch statements' }, { status: 500 });
  }
});
