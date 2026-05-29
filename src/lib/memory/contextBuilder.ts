import { prisma } from '@/lib/db';
import { computeGoalProgress } from '@/lib/goals/calculations';
import type { Goal } from '@/lib/goals/types';
import { getOrCreateDefaultJourney } from './journey';
import { rankMemories, type RankOptions } from './relevance';
import type { FinancialMemory } from './types';

export interface FinancialContextPackage {
  journey: { title: string; summary: string | null; currentFocus: string | null };
  activeGoals: { name: string; type: string; requiredMonthly: number | null; percentComplete: number }[];
  recentDecisions: { title: string; content: string }[];
  importantAssumptions: { title: string; content: string }[];
  knownConstraints: { title: string; content: string }[];
  relevantPreferences: { title: string; content: string }[];
  openNextSteps: { title: string; content: string }[];
  recentConversationSummary: { title: string; summary: string | null } | null;
  relatedMemories: { type: string; title: string; content: string }[];
}

function pick(memories: FinancialMemory[], type: string, limit: number) {
  return memories
    .filter((m) => m.memoryType === type && m.status === 'active')
    .slice(0, limit)
    .map((m) => ({ title: m.title, content: m.content }));
}

/**
 * Assemble a compact, ranked financial-context package for AI conversations.
 * Pulls the journey, active goals, durable memories, and the latest conversation
 * summary, capping each section so the prompt never gets overloaded.
 */
export async function buildFinancialContext(opts: RankOptions = {}): Promise<FinancialContextPackage> {
  const [journey, goals, memories, lastConversation] = await Promise.all([
    getOrCreateDefaultJourney(),
    prisma.goal.findMany({ where: { status: 'ACTIVE' }, orderBy: { priority: 'desc' }, take: 8 }),
    prisma.financialMemory.findMany({ where: { status: 'active' }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] }),
    prisma.conversationMemory.findFirst({ orderBy: { createdAt: 'desc' } }),
  ]);

  const activeGoals = goals.map((g) => {
    const calc = computeGoalProgress(g as unknown as Goal);
    return {
      name: g.name,
      type: g.type,
      requiredMonthly: calc.requiredMonthly,
      percentComplete: Math.round(calc.percentComplete),
    };
  });

  const ranked = rankMemories(memories as unknown as FinancialMemory[], opts, 8);

  return {
    journey: { title: journey.title, summary: journey.summary, currentFocus: journey.currentFocus },
    activeGoals,
    recentDecisions: pick(memories as unknown as FinancialMemory[], 'decision', 5),
    importantAssumptions: pick(memories as unknown as FinancialMemory[], 'assumption', 5),
    knownConstraints: pick(memories as unknown as FinancialMemory[], 'risk', 5),
    relevantPreferences: pick(memories as unknown as FinancialMemory[], 'preference', 5),
    openNextSteps: pick(memories as unknown as FinancialMemory[], 'next_step', 5),
    recentConversationSummary: lastConversation
      ? { title: lastConversation.title ?? 'Previous conversation', summary: lastConversation.rawSummary }
      : null,
    relatedMemories: ranked.map((m) => ({ type: m.memoryType, title: m.title, content: m.content })),
  };
}

function money(n: number): string {
  return `$${n.toFixed(0)}`;
}

function listSection(title: string, items: { title: string; content: string }[]): string[] {
  if (items.length === 0) return [];
  return [`${title}:`, ...items.map((i) => `- ${i.title}: ${i.content}`)];
}

/**
 * Render the context package as a compact markdown block for prompt injection.
 * Returns an empty string when there's nothing meaningful to add, so the chat
 * prompt is only extended when memory exists.
 */
export function renderContextText(ctx: FinancialContextPackage): string {
  const lines: string[] = [];

  const hasContent =
    ctx.activeGoals.length ||
    ctx.recentDecisions.length ||
    ctx.importantAssumptions.length ||
    ctx.knownConstraints.length ||
    ctx.relevantPreferences.length ||
    ctx.openNextSteps.length ||
    ctx.recentConversationSummary ||
    ctx.journey.summary ||
    ctx.journey.currentFocus;

  if (!hasContent) return '';

  lines.push('## Financial Journey Memory');
  lines.push(
    'Use this remembered context from previous interactions. Treat assumptions as unconfirmed (not facts), respect the user\'s decisions and preferences, and do not silently override them. Mention when you rely on remembered context.',
  );

  if (ctx.journey.summary) lines.push(`Journey: ${ctx.journey.summary}`);
  if (ctx.journey.currentFocus) lines.push(`Current focus: ${ctx.journey.currentFocus}`);

  if (ctx.activeGoals.length) {
    lines.push('Active goals:');
    for (const g of ctx.activeGoals) {
      const req = g.requiredMonthly != null ? `, needs ${money(g.requiredMonthly)}/mo` : '';
      lines.push(`- ${g.name} (${g.type}, ${g.percentComplete}% done${req})`);
    }
  }

  lines.push(...listSection('Recent decisions', ctx.recentDecisions));
  lines.push(...listSection('Important assumptions', ctx.importantAssumptions));
  lines.push(...listSection('Known constraints/risks', ctx.knownConstraints));
  lines.push(...listSection('Preferences', ctx.relevantPreferences));
  lines.push(...listSection('Open next steps', ctx.openNextSteps));

  if (ctx.recentConversationSummary?.summary) {
    lines.push(`Most recent conversation: ${ctx.recentConversationSummary.summary}`);
  }

  return lines.join('\n');
}
