import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  try {
    const { id, planId } = await params;

    const plan = await prisma.goalPlan.findUnique({
      where: { id: planId },
      select: { id: true, goalId: true },
    });

    if (!plan || plan.goalId !== id) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    await prisma.goalPlan.delete({ where: { id: planId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete plan:', error);
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 });
  }
}
