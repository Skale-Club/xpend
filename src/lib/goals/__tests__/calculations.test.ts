import { describe, it, expect } from 'vitest';
import { computeGoalProgress, daysUntil } from '@/lib/goals/calculations';
import type { Goal } from '@/lib/goals/types';

const baseGoal = {
  id: 'g1',
  name: 'Test goal',
  type: 'SAVINGS',
  status: 'ACTIVE',
  priority: 'MEDIUM',
} as unknown as Goal;

describe('daysUntil', () => {
  it('never returns a negative window', () => {
    const now = new Date('2026-07-10T00:00:00Z');
    expect(daysUntil(new Date('2026-07-01T00:00:00Z'), now)).toBe(0);
    expect(daysUntil(new Date('2026-07-20T00:00:00Z'), now)).toBe(10);
  });
});

describe('computeGoalProgress', () => {
  it('computes remaining amount and percent', () => {
    const result = computeGoalProgress(
      { ...baseGoal, targetAmount: 1000, currentAmount: 250, targetDate: null } as Goal
    );
    expect(result.amountRemaining).toBe(750);
    expect(result.percentComplete).toBe(25);
    expect(result.isComplete).toBe(false);
    expect(result.requiredMonthly).toBeNull();
  });

  it('clamps percent at 100 and flags completion', () => {
    const result = computeGoalProgress(
      { ...baseGoal, targetAmount: 1000, currentAmount: 1500, targetDate: null } as Goal
    );
    expect(result.amountRemaining).toBe(0);
    expect(result.percentComplete).toBe(100);
    expect(result.isComplete).toBe(true);
  });

  it('derives required monthly savings from the remaining window', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const result = computeGoalProgress(
      {
        ...baseGoal,
        targetAmount: 1200,
        currentAmount: 0,
        targetDate: '2027-01-01T00:00:00Z',
      } as Goal,
      now
    );
    expect(result.daysRemaining).toBe(365);
    expect(result.requiredMonthly).toBeGreaterThan(90);
    expect(result.requiredMonthly).toBeLessThan(110);
  });
});
