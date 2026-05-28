import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildGoalAiContext } from '@/lib/goals/aiContext';
import { generateGoalAiPlans } from '@/lib/goals/aiPlanner';
import type { Goal } from '@/lib/goals/types';

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const settings = await prisma.settings.findUnique({
      where: { id: 'default' },
      select: { geminiApiKey: true, geminiChatModel: true },
    });

    if (!settings?.geminiApiKey) {
      return NextResponse.json(
        { error: 'AI is not configured. Add an OpenRouter API key in Settings to generate plans.' },
        { status: 400 }
      );
    }

    const context = await buildGoalAiContext(id);

    const plans = await generateGoalAiPlans({
      goal: goal as unknown as Goal,
      context,
      apiKey: settings.geminiApiKey,
      model: settings.geminiChatModel,
    });

    return NextResponse.json({ context, plans });
  } catch (error) {
    console.error('Failed to generate AI plan:', error);
    return NextResponse.json({ error: 'Failed to generate AI plan' }, { status: 500 });
  }
}
