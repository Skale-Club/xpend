import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateGoalData, ValidationError } from '@/lib/validation';
import { buildGoalData } from '@/lib/goals/payload';

export async function GET() {
  try {
    const goals = await prisma.goal.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        linkedAccount: { select: { id: true, name: true, color: true } },
        linkedCategory: { select: { id: true, name: true, color: true } },
      },
    });
    return NextResponse.json(goals);
  } catch (error) {
    console.error('Failed to fetch goals:', error);
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    validateGoalData(body);

    const goal = await prisma.goal.create({
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
    console.error('Failed to create goal:', error);
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
  }
}
