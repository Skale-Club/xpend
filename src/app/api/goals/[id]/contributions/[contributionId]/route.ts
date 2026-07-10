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
    // atomically. The decrement mirrors the increment used on create, so
    // concurrent contributions cannot clobber each other; the clamp covers a
    // manual baseline lower than the deleted contribution.
    await prisma.$transaction(async (tx) => {
      await tx.goalContribution.delete({ where: { id: contributionId } });
      await tx.goal.update({
        where: { id },
        data: { currentAmount: { decrement: contribution.amount } },
      });
      await tx.goal.updateMany({
        where: { id, currentAmount: { lt: 0 } },
        data: { currentAmount: 0 },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete contribution:', error);
    return NextResponse.json({ error: 'Failed to delete contribution' }, { status: 500 });
  }
}
