import type { Goal, GoalCalculation, GoalRiskStatus } from './types';

export interface RiskContext {
  // Average monthly surplus (income - expenses) available to fund goals.
  monthlySurplus?: number | null;
  // Average monthly income, used to gauge how aggressive the required
  // savings rate is relative to what the user earns.
  monthlyIncome?: number | null;
}

// Required savings beyond this fraction of monthly surplus is "at risk".
const SURPLUS_STRETCH = 1.0;
// Required savings above this fraction of income is inherently risky.
const INCOME_PRESSURE = 0.4;
// Within this fraction of the linear-pace expectation counts as on track.
const PACE_TOLERANCE = 0.95;

/**
 * Compute a goal's risk status from its progress calculation and, when
 * available, the user's real cash-flow context. Risk is never persisted — it
 * is derived on read so it always reflects current data.
 */
export function computeRiskStatus(
  goal: Goal,
  calc: GoalCalculation,
  context: RiskContext = {},
): GoalRiskStatus {
  if (calc.isComplete) return 'COMPLETED';

  // No deadline: we can't judge pace, only completeness.
  if (!goal.targetDate || calc.daysRemaining === null || calc.requiredMonthly === null) {
    return 'NO_DEADLINE';
  }

  // Deadline already passed and not complete.
  if (calc.daysRemaining === 0) return 'AT_RISK';

  const { monthlySurplus, monthlyIncome } = context;

  // If we know the user's surplus, judge feasibility of the required monthly amount.
  if (monthlySurplus != null) {
    if (calc.requiredMonthly > monthlySurplus * SURPLUS_STRETCH) {
      return 'AT_RISK';
    }
  }

  // Required savings consuming a large share of income is risky even if
  // surplus technically covers it.
  if (monthlyIncome != null && monthlyIncome > 0) {
    if (calc.requiredMonthly / monthlyIncome > INCOME_PRESSURE) {
      return 'AT_RISK';
    }
  }

  // Pace check: are we ahead of or behind the straight-line expectation?
  const expectedPercent = expectedLinearPercent(goal, calc);
  if (expectedPercent != null && calc.percentComplete < expectedPercent * PACE_TOLERANCE) {
    return 'BEHIND';
  }

  return 'ON_TRACK';
}

/**
 * The percent of the goal that "should" be complete by now assuming linear
 * progress from startDate to targetDate. Returns null when the window is
 * unknown or degenerate.
 */
function expectedLinearPercent(goal: Goal, calc: GoalCalculation): number | null {
  const start = goal.startDate ? new Date(goal.startDate) : null;
  const target = goal.targetDate ? new Date(goal.targetDate) : null;
  if (!start || !target || isNaN(start.getTime()) || isNaN(target.getTime())) {
    return null;
  }
  const totalMs = target.getTime() - start.getTime();
  if (totalMs <= 0) return null;
  const elapsedMs = Date.now() - start.getTime();
  const fraction = Math.min(1, Math.max(0, elapsedMs / totalMs));
  void calc;
  return fraction * 100;
}
