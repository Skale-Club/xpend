import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; scenarioId: string }> }
) {
  try {
    const { id, scenarioId } = await params;

    const scenario = await prisma.goalScenario.findUnique({
      where: { id: scenarioId },
      select: { id: true, goalId: true },
    });

    if (!scenario || scenario.goalId !== id) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    await prisma.goalScenario.delete({ where: { id: scenarioId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete scenario:', error);
    return NextResponse.json({ error: 'Failed to delete scenario' }, { status: 500 });
  }
}
