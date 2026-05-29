import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withApiLogging } from '@/lib/apiLogger';
import { computeAvailableLimit } from '@/lib/creditCard/limit';

/**
 * Summary of every credit-card account: limit, computed available limit, and the
 * most recent (current) invoice. Used by the accounts list to render the limit
 * usage bar and the upcoming due date.
 */
export const GET = withApiLogging(async (_request: Request) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { type: 'CREDIT_CARD' },
      include: {
        invoices: {
          orderBy: [{ referenceYear: 'desc' }, { referenceMonth: 'desc' }],
        },
      },
    });

    const summaries = accounts.map((account) => {
      const invoices = account.invoices;
      const current = invoices[0] ?? null;
      const availableLimit = computeAvailableLimit(account.creditLimit, invoices);
      return {
        accountId: account.id,
        creditLimit: account.creditLimit,
        availableLimit,
        dueDay: account.dueDay,
        closingDay: account.closingDay,
        currentInvoice: current
          ? {
              id: current.id,
              referenceMonth: current.referenceMonth,
              referenceYear: current.referenceYear,
              totalAmount: current.totalAmount,
              dueDate: current.dueDate,
              status: current.status,
            }
          : null,
      };
    });

    return NextResponse.json(summaries);
  } catch (error) {
    console.error('Failed to fetch credit-card summaries:', error);
    return NextResponse.json({ error: 'Failed to fetch credit-card summaries' }, { status: 500 });
  }
});
