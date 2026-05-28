import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateGoalData, ValidationError } from '@/lib/validation';
import { buildGoalData } from '@/lib/goals/payload';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const goal = await prisma.goal.findUnique({
      where: { id },
      include: {
        linkedAccount: { select: { id: true, name: true, color: true } },
        linkedCategory: { select: { id: true, name: true, color: true } },
        plans: { orderBy: { createdAt: 'desc' } },
        scenarios: { orderBy: { createdAt: 'desc' } },
        milestones: { orderBy: { targetAmount: 'asc' } },
        contributions: {
          orderBy: { date: 'desc' },
          include: { account: { select: { id: true, name: true, color: true } } },
        },
      },
    });
    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }
    return NextResponse.json(goal);
  } catch (error) {
    console.error('Failed to fetch goal:', error);
    return NextResponse.json({ error: 'Failed to fetch goal' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    validateGoalData(body);

    const goal = await prisma.goal.update({
      where: { id },
      data: buildGoalData(body),
      include: {
        linkedAccount: { select: { id: true, name: true, color: true } },
        linkedCategory: { select: { id: true, name: true, color: true } },
      },
    });
    return NextResponse.json(goal);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to update goal:', error);
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.goal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete goal:', error);
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
  }
}
