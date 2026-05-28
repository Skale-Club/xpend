import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ValidationError } from '@/lib/validation';

const VALID_PLAN_TYPES = ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE', 'CUSTOM'];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const plans = await prisma.goalPlan.findMany({
      where: { goalId: id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(plans);
  } catch (error) {
    console.error('Failed to fetch plans:', error);
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.planType || !VALID_PLAN_TYPES.includes(body.planType)) {
      throw new ValidationError(`Valid planType is required (${VALID_PLAN_TYPES.join(', ')})`);
    }

    const goal = await prisma.goal.findUnique({ where: { id }, select: { id: true } });
    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Persist a plan snapshot. The numeric targets are stored as columns; the
    // AI narrative (summary, feasibility, risk, recommendations, next steps) is
    // serialized into recommendationsJson, and assumptions into assumptionsJson.
    const recommendations = {
      summary: body.summary ?? null,
      targetDateFeasibility: body.targetDateFeasibility ?? null,
      riskLevel: body.riskLevel ?? null,
      recommendedSpendingChanges: body.recommendedSpendingChanges ?? [],
      incomeIncreaseIdeas: body.incomeIncreaseIdeas ?? [],
      nextSteps: body.nextSteps ?? [],
    };

    const plan = await prisma.goalPlan.create({
      data: {
        goalId: id,
        planType: body.planType,
        monthlyTarget: body.monthlyTarget != null ? Number(body.monthlyTarget) : null,
        weeklyTarget: body.weeklyTarget != null ? Number(body.weeklyTarget) : null,
        dailyTarget: body.dailyTarget != null ? Number(body.dailyTarget) : null,
        projectedCompletionDate: body.projectedCompletionDate
          ? new Date(body.projectedCompletionDate)
          : null,
        assumptionsJson: body.assumptions ? JSON.stringify(body.assumptions) : null,
        recommendationsJson: JSON.stringify(recommendations),
        createdBy: body.createdBy === 'user' ? 'user' : 'ai',
      },
    });

    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to save plan:', error);
    return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 });
  }
}
