import type { MemoryStatus } from './types';

// A memory is "live" (should be considered current by the AI) only when active.
export function isLiveMemory(status: string): boolean {
  return status === 'active';
}

// Statuses that mean the memory should no longer be treated as a current fact.
const RETIRED: MemoryStatus[] = ['archived', 'superseded', 'rejected'];

export function isRetiredMemory(status: string): boolean {
  return (RETIRED as string[]).includes(status);
}

// Whether a transition between two statuses is allowed. Kept permissive but
// blocks resurrecting a superseded memory (it must be re-created instead).
export function canTransition(from: string, to: string): boolean {
  if (from === to) return true;
  if (from === 'superseded' && to !== 'archived') return false;
  return true;
}
