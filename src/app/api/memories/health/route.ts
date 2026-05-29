import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  runHealthChecks,
  detectContradictions,
  findStaleMemories,
  changesSince,
} from '@/lib/memory/intelligence';
import type { FinancialMemory } from '@/lib/memory/types';

export async function GET() {
  try {
    const memories = (await prisma.financialMemory.findMany({
      orderBy: { createdAt: 'desc' },
    })) as unknown as FinancialMemory[];

    // Reference for "what changed since last plan": the most recent saved goal
    // plan, falling back to the most recent conversation summary.
    const [lastPlan, lastConversation] = await Promise.all([
      prisma.goalPlan.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.conversationMemory.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);
    const sinceDate = lastPlan?.createdAt ?? lastConversation?.createdAt ?? null;

    const findings = detectContradictions(memories);

    return NextResponse.json({
      report: runHealthChecks(memories),
      contradictions: findings.filter((f) => f.kind === 'conflict'),
      supersedeSuggestions: findings.filter((f) => f.kind === 'duplicate'),
      stale: findStaleMemories(memories),
      changesSinceLastPlan: changesSince(memories, sinceDate),
    });
  } catch (error) {
    console.error('Failed to run memory health checks:', error);
    return NextResponse.json({ error: 'Failed to run memory health checks' }, { status: 500 });
  }
}
