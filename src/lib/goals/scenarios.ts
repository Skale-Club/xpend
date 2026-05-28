import type { Goal, GoalCalculation } from './types';

const DAYS_PER_MONTH = 365.25 / 12;
const WEEKS_PER_MONTH = 52 / 12;

export interface ScenarioSpendingCut {
  category: string;
  amount: number;
}

export interface ScenarioIncomeIncrease {
  source: string;
  amount: number;
}

export interface ScenarioInput {
  monthlySavings?: number | null;
  spendingCuts?: ScenarioSpendingCut[];
  incomeIncrease?: ScenarioIncomeIncrease[];
}

export interface ScenarioProjection {
  effectiveMonthly: number;
  effectiveWeekly: number;
  monthsToComplete: number | null; // null when funding is zero and amount remains
  projectedCompletionDate: string | null;
  meetsTargetDate: boolean | null; // null when the goal has no target date
  requiredMonthly: number | null;
  monthlyDelta: number | null; // effective − required
  riskLevel: 'low' | 'medium' | 'high';
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  const whole = Math.floor(months);
  const fracDays = Math.round((months - whole) * DAYS_PER_MONTH);
  d.setMonth(d.getMonth() + whole);
  d.setDate(d.getDate() + fracDays);
  return d;
}

function sum(values: { amount: number }[] | undefined): number {
  if (!values) return 0;
  return values.reduce((acc, v) => acc + (Number(v.amount) || 0), 0);
}

/**
 * Compute the total monthly funding a scenario makes available toward a goal:
 * a committed base savings amount plus any monthly spending cuts plus any
 * monthly income increases.
 */
export function effectiveMonthlyFunding(input: ScenarioInput): number {
  const base = Number(input.monthlySavings) || 0;
  return base + sum(input.spendingCuts) + sum(input.incomeIncrease);
}

/**
 * Pure what-if projection: given a goal, its current progress, and a scenario's
 * funding assumptions, project when the goal completes, whether it meets the
 * target date, and how risky the plan is. No external data or AI involved.
 */
export function simulateScenario(
  goal: Goal,
  calc: GoalCalculation,
  input: ScenarioInput,
  now: Date = new Date(),
): ScenarioProjection {
  const remaining = calc.amountRemaining;
  const effectiveMonthly = effectiveMonthlyFunding(input);
  const requiredMonthly = calc.requiredMonthly;
  const targetDate = goal.targetDate ? new Date(goal.targetDate) : null;
  const hasTarget = targetDate != null && !isNaN(targetDate.getTime());

  // Already complete.
  if (remaining <= 0) {
    return {
      effectiveMonthly,
      effectiveWeekly: effectiveMonthly / WEEKS_PER_MONTH,
      monthsToComplete: 0,
      projectedCompletionDate: now.toISOString(),
      meetsTargetDate: hasTarget ? true : null,
      requiredMonthly,
      monthlyDelta: requiredMonthly != null ? effectiveMonthly - requiredMonthly : null,
      riskLevel: 'low',
    };
  }

  // No funding: goal can't be reached under this scenario.
  if (effectiveMonthly <= 0) {
    return {
      effectiveMonthly,
      effectiveWeekly: 0,
      monthsToComplete: null,
      projectedCompletionDate: null,
      meetsTargetDate: hasTarget ? false : null,
      requiredMonthly,
      monthlyDelta: requiredMonthly != null ? effectiveMonthly - requiredMonthly : null,
      riskLevel: 'high',
    };
  }

  const monthsToComplete = remaining / effectiveMonthly;
  const projected = addMonths(now, monthsToComplete);
  const meetsTargetDate = hasTarget ? projected.getTime() <= targetDate!.getTime() : null;

  let riskLevel: 'low' | 'medium' | 'high';
  if (requiredMonthly == null) {
    // No deadline: any positive funding will get there eventually.
    riskLevel = 'low';
  } else if (effectiveMonthly >= requiredMonthly) {
    riskLevel = 'low';
  } else if (effectiveMonthly >= requiredMonthly * 0.9) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'high';
  }

  return {
    effectiveMonthly,
    effectiveWeekly: effectiveMonthly / WEEKS_PER_MONTH,
    monthsToComplete,
    projectedCompletionDate: projected.toISOString(),
    meetsTargetDate,
    requiredMonthly,
    monthlyDelta: requiredMonthly != null ? effectiveMonthly - requiredMonthly : null,
    riskLevel,
  };
}
