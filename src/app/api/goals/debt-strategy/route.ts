import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildDebtStrategy, type DebtInput } from '@/lib/goals/debtPayoff';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const extraRaw = searchParams.get('extra');
    const extra = extraRaw != null ? Number(extraRaw) : 0;
    if (isNaN(extra) || extra < 0) {
      return NextResponse.json({ error: 'extra must be a non-negative number' }, { status: 400 });
    }

    const debts = await prisma.goal.findMany({
      where: { type: 'DEBT_PAYOFF', status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        targetAmount: true,
        currentAmount: true,
        interestRate: true,
        minimumPayment: true,
      },
    });

    const inputs: DebtInput[] = debts
      .map((d) => ({
        id: d.id,
        name: d.name,
        balance: Math.max(0, (d.targetAmount || 0) - (d.currentAmount || 0)),
        annualRate: d.interestRate || 0,
        minimumPayment: d.minimumPayment || 0,
      }))
      .filter((d) => d.balance > 0);

    const snowball = buildDebtStrategy(inputs, extra, 'snowball');
    const avalanche = buildDebtStrategy(inputs, extra, 'avalanche');

    return NextResponse.json({
      debtCount: inputs.length,
      totalBalance: inputs.reduce((sum, d) => sum + d.balance, 0),
      extra,
      snowball,
      avalanche,
    });
  } catch (error) {
    console.error('Failed to compute debt strategy:', error);
    return NextResponse.json({ error: 'Failed to compute debt strategy' }, { status: 500 });
  }
}
