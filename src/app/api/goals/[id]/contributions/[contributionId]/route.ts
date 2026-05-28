import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; contributionId: string }> }
) {
  try {
    const { id, contributionId } = await params;

    const contribution = await prisma.goalContribution.findUnique({
      where: { id: contributionId },
      select: { id: true, goalId: true, amount: true },
    });

    if (!contribution || contribution.goalId !== id) {
      return NextResponse.json({ error: 'Contribution not found' }, { status: 404 });
    }

    // Remove the contribution and roll back its effect on goal progress
    // atomically. currentAmount is floored at 0 to avoid going negative.
    await prisma.$transaction(async (tx) => {
      await tx.goalContribution.delete({ where: { id: contributionId } });
      const goal = await tx.goal.findUnique({ where: { id }, select: { currentAmount: true } });
      const next = Math.max(0, (goal?.currentAmount ?? 0) - contribution.amount);
      await tx.goal.update({ where: { id }, data: { currentAmount: next } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete contribution:', error);
    return NextResponse.json({ error: 'Failed to delete contribution' }, { status: 500 });
  }
}
