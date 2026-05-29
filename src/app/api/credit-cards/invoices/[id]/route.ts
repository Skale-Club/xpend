import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withApiLogging } from '@/lib/apiLogger';
import type { InvoiceStatus } from '@/types';

const VALID_STATUSES: InvoiceStatus[] = ['OPEN', 'CLOSED', 'PAID', 'PARTIAL'];

/** A single invoice with its transactions and installment markers. */
export const GET = withApiLogging(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const invoice = await prisma.creditCardInvoice.findUnique({
      where: { id },
      include: {
        account: { select: { id: true, name: true } },
        transactions: {
          orderBy: { date: 'desc' },
          include: { category: { select: { id: true, name: true, color: true } } },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Failed to fetch invoice:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
});

/**
 * Updates an invoice's payment state. The user owns these fields — the fatura
 * extraction never writes them — so this is the single place status/paidAt/
 * paidAmount change.
 */
export const PATCH = withApiLogging(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const status = body.status as InvoiceStatus | undefined;
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const paidAmount =
      body.paidAmount === undefined || body.paidAmount === null || body.paidAmount === ''
        ? undefined
        : Number(body.paidAmount);
    if (paidAmount !== undefined && !Number.isFinite(paidAmount)) {
      return NextResponse.json({ error: 'Invalid paidAmount' }, { status: 400 });
    }

    const isPaid = status === 'PAID';
    const invoice = await prisma.creditCardInvoice.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(paidAmount !== undefined ? { paidAmount } : {}),
        // Stamp paidAt when moving to PAID; clear it when reopening.
        ...(status ? { paidAt: isPaid ? new Date() : status === 'OPEN' ? null : undefined } : {}),
      },
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Failed to update invoice:', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
});
