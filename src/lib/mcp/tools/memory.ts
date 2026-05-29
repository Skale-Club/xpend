import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma';
import { buildFinancialContext, renderContextText } from '@/lib/memory/contextBuilder';
import { getOrCreateDefaultJourney } from '@/lib/memory/journey';
import { validateMemoryData, ValidationError } from '@/lib/validation';

const MEMORY_TYPES = ['decision', 'assumption', 'plan', 'goal', 'risk', 'preference', 'next_step', 'conversation_summary'];
const MEMORY_STATUSES = ['active', 'archived', 'superseded', 'rejected', 'needs_review'];

// ---- Read-only tools ----

export async function get_financial_journey_summary() {
  const journey = await getOrCreateDefaultJourney();
  const [active, needsReview, openNextSteps] = await Promise.all([
    prisma.financialMemory.count({ where: { status: 'active' } }),
    prisma.financialMemory.count({ where: { status: 'needs_review' } }),
    prisma.financialMemory.count({ where: { status: 'active', memoryType: 'next_step' } }),
  ]);
  return {
    title: journey.title,
    summary: journey.summary,
    currentFocus: journey.currentFocus,
    counts: { activeMemories: active, needsReview, openNextSteps },
  };
}

export async function search_financial_memories(params: {
  memoryType?: string;
  status?: string;
  q?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  limit?: number;
}) {
  const where: Prisma.FinancialMemoryWhereInput = {
    ...(params.memoryType ? { memoryType: params.memoryType } : {}),
    ...(params.status ? { status: params.status } : { status: 'active' }),
    ...(params.relatedEntityType ? { relatedEntityType: params.relatedEntityType } : {}),
    ...(params.relatedEntityId ? { relatedEntityId: params.relatedEntityId } : {}),
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: 'insensitive' } },
            { content: { contains: params.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const memories = await prisma.financialMemory.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    take: Math.min(params.limit ?? 20, 100),
    select: { id: true, memoryType: true, title: true, content: true, status: true, confidence: true, createdAt: true },
  });
  return { count: memories.length, memories };
}

export async function get_relevant_financial_context(params: {
  topic?: string;
  entityType?: string;
  entityId?: string;
}) {
  const context = await buildFinancialContext({
    topic: params.topic ?? null,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
  });
  return { context, text: renderContextText(context) };
}

export async function list_open_financial_next_steps() {
  const steps = await prisma.financialMemory.findMany({
    where: { memoryType: 'next_step', status: 'active' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, content: true, createdAt: true },
  });
  return { count: steps.length, nextSteps: steps };
}

export async function get_goal_memory_context(params: { goalId: string }) {
  if (!params.goalId) throw new Error('goalId is required');
  const context = await buildFinancialContext({ entityType: 'goal', entityId: params.goalId });
  const memories = await prisma.financialMemory.findMany({
    where: { status: 'active', relatedEntityType: 'goal', relatedEntityId: params.goalId },
    select: { id: true, memoryType: true, title: true, content: true },
  });
  return { goalId: params.goalId, linkedMemories: memories, context, text: renderContextText(context) };
}

// ---- Write tools (audited by the JSON-RPC layer) ----

export async function create_financial_memory(params: {
  memoryType: string;
  title: string;
  content: string;
  confidence?: number;
  priority?: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  validateMemoryData(params as Record<string, unknown>);

  const memory = await prisma.financialMemory.create({
    data: {
      memoryType: params.memoryType,
      title: params.title.trim(),
      content: params.content.trim(),
      status: 'active',
      source: 'mcp',
      confidence: params.confidence ?? null,
      priority: params.priority ?? 0,
      relatedEntityType: params.relatedEntityType || null,
      relatedEntityId: params.relatedEntityId || null,
    },
    select: { id: true, memoryType: true, title: true, status: true },
  });
  return { success: true, memory };
}

export async function propose_financial_memory(params: {
  proposedMemoryType: string;
  title: string;
  content: string;
  confidence?: number;
}) {
  if (!params.title?.trim()) throw new ValidationError('title is required');
  if (!params.content?.trim()) throw new ValidationError('content is required');
  if (!MEMORY_TYPES.includes(params.proposedMemoryType)) {
    throw new ValidationError(`Valid proposedMemoryType is required (${MEMORY_TYPES.join(', ')})`);
  }

  const item = await prisma.memoryReviewQueue.create({
    data: {
      proposedMemoryType: params.proposedMemoryType,
      title: params.title.trim(),
      content: params.content.trim(),
      confidence: params.confidence ?? null,
      status: 'pending',
    },
    select: { id: true, proposedMemoryType: true, title: true, status: true },
  });
  return { success: true, queued: item, note: 'Proposed memory added to the review queue for user confirmation.' };
}

export async function update_financial_memory_status(params: {
  memoryId: string;
  status: string;
  supersededById?: string;
}) {
  if (!params.memoryId) throw new Error('memoryId is required');
  if (!MEMORY_STATUSES.includes(params.status)) {
    throw new ValidationError(`status must be one of ${MEMORY_STATUSES.join(', ')}`);
  }

  const memory = await prisma.financialMemory.update({
    where: { id: params.memoryId },
    data: {
      status: params.status,
      ...(params.supersededById ? { supersededBy: { connect: { id: params.supersededById } } } : {}),
    },
    select: { id: true, status: true, supersededById: true },
  });
  return { success: true, memory };
}

export async function record_financial_decision(params: {
  title: string;
  content: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  if (!params.title?.trim()) throw new ValidationError('title is required');
  if (!params.content?.trim()) throw new ValidationError('content is required');

  const journey = await getOrCreateDefaultJourney();
  const [memory] = await prisma.$transaction([
    prisma.financialMemory.create({
      data: {
        memoryType: 'decision',
        title: params.title.trim(),
        content: params.content.trim(),
        status: 'active',
        source: 'mcp',
        relatedEntityType: params.relatedEntityType || null,
        relatedEntityId: params.relatedEntityId || null,
      },
      select: { id: true, title: true },
    }),
    prisma.journeyEntry.create({
      data: {
        journeyId: journey.id,
        entryType: 'decision',
        title: params.title.trim(),
        summary: params.content.trim(),
        source: 'mcp',
        relatedGoalId: params.relatedEntityType === 'goal' ? params.relatedEntityId || null : null,
      },
    }),
  ]);
  return { success: true, memory };
}

export async function record_plan_update(params: {
  title: string;
  content: string;
  relatedGoalId?: string;
}) {
  if (!params.title?.trim()) throw new ValidationError('title is required');
  if (!params.content?.trim()) throw new ValidationError('content is required');

  const journey = await getOrCreateDefaultJourney();
  const [memory] = await prisma.$transaction([
    prisma.financialMemory.create({
      data: {
        memoryType: 'plan',
        title: params.title.trim(),
        content: params.content.trim(),
        status: 'active',
        source: 'mcp',
        relatedEntityType: params.relatedGoalId ? 'goal' : null,
        relatedEntityId: params.relatedGoalId || null,
      },
      select: { id: true, title: true },
    }),
    prisma.journeyEntry.create({
      data: {
        journeyId: journey.id,
        entryType: 'plan',
        title: params.title.trim(),
        summary: params.content.trim(),
        source: 'mcp',
        relatedGoalId: params.relatedGoalId || null,
      },
    }),
  ]);
  return { success: true, memory };
}
