import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const year = searchParams.get('year');

    const where: { accountId?: string; year?: number } = {};
    if (accountId) where.accountId = accountId;
    if (year) where.year = parseInt(year);

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
    }));

    return NextResponse.json(transformedStatements);
  } catch (error) {
    console.error('Failed to fetch statements:', error);
    return NextResponse.json({ error: 'Failed to fetch statements' }, { status: 500 });
  }
}
