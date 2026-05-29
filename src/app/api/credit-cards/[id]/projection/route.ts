import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withApiLogging } from '@/lib/apiLogger';
import { invoiceReferenceForDate, nextInvoiceReference } from '@/lib/creditCard/invoiceCycle';

/**
 * Projects future installment parcels for a credit card WITHOUT writing any
 * phantom transactions. For each installment group, the most recently recorded
 * parcel is rolled forward one fatura per remaining parcel. When the next real
 * fatura is uploaded, that parcel becomes a real row and dedup keeps it from
 * being double counted here.
 */
export const GET = withApiLogging(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id: accountId } = await params;

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const parcels = await prisma.transaction.findMany({
      where: {
        accountId,
        installmentGroupId: { not: null },
        installmentTotal: { not: null },
        installmentNumber: { not: null },
      },
      select: {
        amount: true,
        description: true,
        date: true,
        installmentNumber: true,
        installmentTotal: true,
        installmentGroupId: true,
        invoice: { select: { referenceMonth: true, referenceYear: true } },
      },
    });

    // Keep only the most recently recorded parcel per installment group.
    type Parcel = (typeof parcels)[number];
    const latestByGroup = new Map<string, Parcel>();
    for (const p of parcels) {
      const gid = p.installmentGroupId!;
      const current = latestByGroup.get(gid);
      if (!current || (p.installmentNumber ?? 0) > (current.installmentNumber ?? 0)) {
        latestByGroup.set(gid, p);
      }
    }

    const projected: {
      installmentGroupId: string;
      description: string;
      amount: number;
      installmentNumber: number;
      installmentTotal: number;
      referenceMonth: number;
      referenceYear: number;
    }[] = [];

    for (const [gid, p] of latestByGroup) {
      const number = p.installmentNumber!;
      const total = p.installmentTotal!;
      const remaining = total - number;
      if (remaining <= 0) continue;

      // Base reference: the parcel's own fatura when linked, else derived from
      // its date and the card's closing day.
      let ref = p.invoice
        ? { month: p.invoice.referenceMonth, year: p.invoice.referenceYear }
        : invoiceReferenceForDate(p.date, account.closingDay);

      for (let i = 1; i <= remaining; i++) {
        ref = nextInvoiceReference(ref);
        projected.push({
          installmentGroupId: gid,
          description: p.description,
          amount: p.amount,
          installmentNumber: number + i,
          installmentTotal: total,
          referenceMonth: ref.month,
          referenceYear: ref.year,
        });
      }
    }

    // Aggregate per future fatura month for convenient display.
    const byMonth = new Map<
      string,
      { referenceMonth: number; referenceYear: number; total: number; count: number }
    >();
    for (const e of projected) {
      const key = `${e.referenceYear}-${e.referenceMonth}`;
      const current =
        byMonth.get(key) ?? { referenceMonth: e.referenceMonth, referenceYear: e.referenceYear, total: 0, count: 0 };
      current.total += e.amount;
      current.count += 1;
      byMonth.set(key, current);
    }
    const monthly = Array.from(byMonth.values()).sort(
      (a, b) => a.referenceYear - b.referenceYear || a.referenceMonth - b.referenceMonth,
    );

    return NextResponse.json({ projected, monthly });
  } catch (error) {
    console.error('Failed to compute projection:', error);
    return NextResponse.json({ error: 'Failed to compute projection' }, { status: 500 });
  }
});
