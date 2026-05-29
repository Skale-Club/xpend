import type { FinancialMemory } from './types';

export interface RankOptions {
  topic?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  now?: Date;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Relevance score for a memory. Higher = more important to surface. Combines
 * priority, recency, confidence, and topic/entity match. Only active memories
 * should be scored (retired ones are filtered out before ranking).
 */
export function scoreMemory(memory: FinancialMemory, opts: RankOptions = {}): number {
  const now = opts.now ?? new Date();
  let score = 0;

  // Priority set by the user/system.
  score += (memory.priority || 0) * 10;

  // Recency: newer memories rank higher, decaying over ~30 days.
  const created = new Date(memory.createdAt).getTime();
  const days = Math.max(0, (now.getTime() - created) / MS_PER_DAY);
  score += Math.max(0, 30 - days) / 3; // up to ~10

  // Confidence (default mid when unknown).
  score += (memory.confidence ?? 0.5) * 5;

  // Topic keyword match against title/content.
  if (opts.topic) {
    const t = opts.topic.toLowerCase();
    const haystack = `${memory.title} ${memory.content} ${memory.normalizedContent ?? ''}`.toLowerCase();
    if (haystack.includes(t)) score += 15;
  }

  // Entity match (e.g., a specific goal or account).
  if (opts.entityType && memory.relatedEntityType === opts.entityType) {
    if (!opts.entityId || memory.relatedEntityId === opts.entityId) {
      score += 20;
    }
  }

  return score;
}

/**
 * Rank active memories by relevance and return the top `limit`.
 */
export function rankMemories(
  memories: FinancialMemory[],
  opts: RankOptions = {},
  limit = 12,
): FinancialMemory[] {
  return memories
    .filter((m) => m.status === 'active')
    .map((m) => ({ m, score: scoreMemory(m, opts) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.m);
}
