import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withApiLogging } from '@/lib/apiLogger';
import { computeAvailableLimit } from '@/lib/creditCard/limit';

/** A credit card with its full invoice history and computed available limit. */
export const GET = withApiLogging(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: [{ referenceYear: 'desc' }, { referenceMonth: 'desc' }],
          include: { _count: { select: { transactions: true } } },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const availableLimit = computeAvailableLimit(account.creditLimit, account.invoices);

    return NextResponse.json({ account, availableLimit });
  } catch (error) {
    console.error('Failed to fetch credit card:', error);
    return NextResponse.json({ error: 'Failed to fetch credit card' }, { status: 500 });
  }
});
