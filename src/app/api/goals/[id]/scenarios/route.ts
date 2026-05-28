import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateScenarioData, ValidationError } from '@/lib/validation';
import { computeGoalProgress } from '@/lib/goals/calculations';
import { simulateScenario, type ScenarioInput } from '@/lib/goals/scenarios';
import type { Goal } from '@/lib/goals/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const scenarios = await prisma.goalScenario.findMany({
      where: { goalId: id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(scenarios);
  } catch (error) {
    console.error('Failed to fetch scenarios:', error);
    return NextResponse.json({ error: 'Failed to fetch scenarios' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    validateScenarioData(body);

    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const input: ScenarioInput = {
      monthlySavings: body.monthlySavings != null && body.monthlySavings !== '' ? Number(body.monthlySavings) : 0,
      spendingCuts: Array.isArray(body.spendingCuts) ? body.spendingCuts : [],
      incomeIncrease: Array.isArray(body.incomeIncrease) ? body.incomeIncrease : [],
    };

    // Compute the projection server-side so the stored snapshot is authoritative.
    const calc = computeGoalProgress(goal as unknown as Goal);
    const projection = simulateScenario(goal as unknown as Goal, calc, input);

    const scenario = await prisma.goalScenario.create({
      data: {
        goalId: id,
        title: String(body.title).trim(),
        scenarioType: body.scenarioType,
        monthlySavings: input.monthlySavings ?? null,
        spendingCutsJson: input.spendingCuts?.length ? JSON.stringify(input.spendingCuts) : null,
        incomeIncreaseJson: input.incomeIncrease?.length ? JSON.stringify(input.incomeIncrease) : null,
        projectedResult: JSON.stringify(projection),
        riskLevel: projection.riskLevel,
      },
    });

    return NextResponse.json(scenario);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to create scenario:', error);
    return NextResponse.json({ error: 'Failed to create scenario' }, { status: 500 });
  }
}
