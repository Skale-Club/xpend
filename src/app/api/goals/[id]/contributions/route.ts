import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateContributionData, ValidationError } from '@/lib/validation';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contributions = await prisma.goalContribution.findMany({
      where: { goalId: id },
      orderBy: { date: 'desc' },
      include: { account: { select: { id: true, name: true, color: true } } },
    });
    return NextResponse.json(contributions);
  } catch (error) {
    console.error('Failed to fetch contributions:', error);
    return NextResponse.json({ error: 'Failed to fetch contributions' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    validateContributionData(body);

    const goal = await prisma.goal.findUnique({ where: { id }, select: { id: true } });
    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const amount = Number(body.amount);

    // Record the contribution and advance the goal's progress atomically so
    // currentAmount always reflects the sum of recorded contributions plus any
    // manually-set baseline.
    const [contribution] = await prisma.$transaction([
      prisma.goalContribution.create({
        data: {
          goalId: id,
          amount,
          date: body.date ? new Date(body.date) : new Date(),
          accountId: (body.accountId as string) || null,
          transactionId: (body.transactionId as string) || null,
          note: body.note ? String(body.note).trim() : null,
        },
        include: { account: { select: { id: true, name: true, color: true } } },
      }),
      prisma.goal.update({
        where: { id },
        data: { currentAmount: { increment: amount } },
      }),
    ]);

    return NextResponse.json(contribution);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to create contribution:', error);
    return NextResponse.json({ error: 'Failed to create contribution' }, { status: 500 });
  }
}
