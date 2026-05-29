import type { FinancialMemory } from './types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const STALE_ASSUMPTION_DAYS = 60;
const LOW_CONFIDENCE = 0.3;
const DUPLICATE_SIMILARITY = 0.6;

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s$.]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

// Jaccard similarity over the token sets of two memories' title+content.
export function similarity(a: FinancialMemory, b: FinancialMemory): number {
  const setA = new Set(normalize(`${a.title} ${a.content}`));
  const setB = new Set(normalize(`${b.title} ${b.content}`));
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface MemoryPairFinding {
  kind: 'duplicate' | 'conflict';
  reason: string;
  newer: { id: string; title: string };
  older: { id: string; title: string };
}

function olderNewer(a: FinancialMemory, b: FinancialMemory): [FinancialMemory, FinancialMemory] {
  const at = new Date(a.createdAt).getTime();
  const bt = new Date(b.createdAt).getTime();
  return at <= bt ? [a, b] : [b, a];
}

/**
 * Detect likely duplicates and conflicts among active memories.
 * - duplicate: same type, highly similar text.
 * - conflict: two active decisions/plans about the same entity that are NOT
 *   similar (they may pull in different directions and should be reconciled).
 */
export function detectContradictions(memories: FinancialMemory[]): MemoryPairFinding[] {
  const active = memories.filter((m) => m.status === 'active');
  const findings: MemoryPairFinding[] = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.memoryType !== b.memoryType) continue;

      const sim = similarity(a, b);
      const [older, newer] = olderNewer(a, b);

      if (sim >= DUPLICATE_SIMILARITY) {
        findings.push({
          kind: 'duplicate',
          reason: `Two active ${a.memoryType} memories look like duplicates (${Math.round(sim * 100)}% similar).`,
          newer: { id: newer.id, title: newer.title },
          older: { id: older.id, title: older.title },
        });
        continue;
      }

      const sameEntity =
        a.relatedEntityType &&
        a.relatedEntityType === b.relatedEntityType &&
        a.relatedEntityId &&
        a.relatedEntityId === b.relatedEntityId;

      if (sameEntity && (a.memoryType === 'decision' || a.memoryType === 'plan') && sim < 0.2) {
        findings.push({
          kind: 'conflict',
          reason: `Two active ${a.memoryType} memories target the same ${a.relatedEntityType} but differ — they may conflict.`,
          newer: { id: newer.id, title: newer.title },
          older: { id: older.id, title: older.title },
        });
      }
    }
  }
  return findings;
}

/**
 * For each duplicate pair, suggest superseding the older memory with the newer.
 */
export function suggestSupersedes(memories: FinancialMemory[]): MemoryPairFinding[] {
  return detectContradictions(memories).filter((f) => f.kind === 'duplicate');
}

export interface StaleFinding {
  id: string;
  title: string;
  reason: string;
}

/**
 * Memories that should probably be reviewed: expired validUntil, old unconfirmed
 * assumptions, or very low confidence.
 */
export function findStaleMemories(memories: FinancialMemory[], now: Date = new Date()): StaleFinding[] {
  const out: StaleFinding[] = [];
  for (const m of memories) {
    if (m.status !== 'active') continue;

    if (m.validUntil && new Date(m.validUntil).getTime() < now.getTime()) {
      out.push({ id: m.id, title: m.title, reason: 'Past its valid-until date.' });
      continue;
    }

    const ageDays = (now.getTime() - new Date(m.createdAt).getTime()) / MS_PER_DAY;
    if (m.memoryType === 'assumption' && ageDays > STALE_ASSUMPTION_DAYS) {
      out.push({
        id: m.id,
        title: m.title,
        reason: `Assumption is ${Math.round(ageDays)} days old and still unconfirmed.`,
      });
      continue;
    }

    if (m.confidence != null && m.confidence < LOW_CONFIDENCE) {
      out.push({ id: m.id, title: m.title, reason: 'Low confidence — confirm or refine.' });
    }
  }
  return out;
}

export interface MemoryHealthReport {
  total: number;
  active: number;
  needsReview: number;
  archived: number;
  superseded: number;
  byType: Record<string, number>;
  duplicates: number;
  conflicts: number;
  stale: number;
}

export function runHealthChecks(memories: FinancialMemory[], now: Date = new Date()): MemoryHealthReport {
  const byType: Record<string, number> = {};
  let active = 0;
  let needsReview = 0;
  let archived = 0;
  let superseded = 0;

  for (const m of memories) {
    if (m.status === 'active') {
      active += 1;
      byType[m.memoryType] = (byType[m.memoryType] ?? 0) + 1;
    } else if (m.status === 'needs_review') needsReview += 1;
    else if (m.status === 'archived') archived += 1;
    else if (m.status === 'superseded') superseded += 1;
  }

  const findings = detectContradictions(memories);

  return {
    total: memories.length,
    active,
    needsReview,
    archived,
    superseded,
    byType,
    duplicates: findings.filter((f) => f.kind === 'duplicate').length,
    conflicts: findings.filter((f) => f.kind === 'conflict').length,
    stale: findStaleMemories(memories, now).length,
  };
}

export interface ChangesSince {
  since: string | null;
  newMemories: { id: string; memoryType: string; title: string; createdAt: string | Date }[];
}

/**
 * Memories created after a reference date — powers "what changed since the last
 * plan?". When `since` is null, returns nothing meaningful (caller decides).
 */
export function changesSince(memories: FinancialMemory[], since: Date | null): ChangesSince {
  if (!since) return { since: null, newMemories: [] };
  const newMemories = memories
    .filter((m) => new Date(m.createdAt).getTime() > since.getTime())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((m) => ({ id: m.id, memoryType: m.memoryType, title: m.title, createdAt: m.createdAt }));
  return { since: since.toISOString(), newMemories };
}
