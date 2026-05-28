import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import { DEFAULT_CHAT_MODEL } from '@/lib/chat/models';
import { computeGoalProgress } from './calculations';
import { GOAL_TYPE_LABELS } from './types';
import type {
  Goal,
  GoalCalculation,
  GoalAiContext,
  GoalPlanType,
  PlanTargets,
  GeneratedGoalPlan,
} from './types';

const WEEKS_PER_MONTH = 52 / 12;
const DAYS_PER_MONTH = 365.25 / 12;
const DEFAULT_HORIZON_MONTHS = 12;

const PLAN_MULTIPLIERS: Record<Exclude<GoalPlanType, 'CUSTOM'>, number> = {
  CONSERVATIVE: 0.75,
  BALANCED: 1.0,
  AGGRESSIVE: 1.3,
};

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  const whole = Math.floor(months);
  const fracDays = Math.round((months - whole) * DAYS_PER_MONTH);
  d.setMonth(d.getMonth() + whole);
  d.setDate(d.getDate() + fracDays);
  return d;
}

/**
 * Deterministic numeric targets for the conservative / balanced / aggressive
 * plans. These are computed by us — never by the AI — so the "calculation"
 * stays separate from the AI "recommendation" (per the project rules).
 *
 * Balanced uses the on-time required monthly amount. Conservative saves less
 * (finishing later); aggressive saves more (finishing earlier). When the goal
 * has no target date, a default horizon is assumed and flagged.
 */
export function computePlanTargets(goal: Goal, calc: GoalCalculation): PlanTargets[] {
  const remaining = calc.amountRemaining;
  const now = new Date();

  let assumedHorizon = false;
  let baseMonthly: number;

  if (calc.requiredMonthly != null) {
    baseMonthly = calc.requiredMonthly;
  } else {
    // No target date: assume a horizon so we can still offer a plan, clearly flagged.
    assumedHorizon = true;
    baseMonthly = remaining / DEFAULT_HORIZON_MONTHS;
  }

  return (['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'] as const).map((planType) => {
    const monthlyTarget = baseMonthly * PLAN_MULTIPLIERS[planType];
    const monthsToComplete = monthlyTarget > 0 ? remaining / monthlyTarget : 0;
    const projectedCompletionDate =
      remaining <= 0
        ? now.toISOString()
        : addMonths(now, monthsToComplete).toISOString();

    return {
      planType,
      monthlyTarget,
      weeklyTarget: monthlyTarget / WEEKS_PER_MONTH,
      dailyTarget: monthlyTarget / DAYS_PER_MONTH,
      projectedCompletionDate,
      assumedHorizon,
    };
  });
}

const planNarrativeSchema = z.object({
  planType: z.enum(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE']),
  summary: z.string(),
  targetDateFeasibility: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high']),
  assumptions: z.array(z.string()),
  recommendedSpendingChanges: z.array(z.string()),
  incomeIncreaseIdeas: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

const responseSchema = z.object({
  plans: z.array(planNarrativeSchema),
});

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function buildPrompt(goal: Goal, calc: GoalCalculation, context: GoalAiContext, targets: PlanTargets[]): string {
  const lines: string[] = [];
  lines.push(`You are a financial planning assistant for the Xpend app. Produce realistic, grounded plans to reach a financial goal.`);
  lines.push('');
  lines.push(`GOAL`);
  lines.push(`- Name: ${goal.name}`);
  lines.push(`- Type: ${GOAL_TYPE_LABELS[goal.type]}`);
  lines.push(`- Target amount: ${money(goal.targetAmount)}`);
  lines.push(`- Saved so far: ${money(goal.currentAmount)}`);
  lines.push(`- Amount remaining: ${money(calc.amountRemaining)}`);
  lines.push(`- Target date: ${goal.targetDate ? new Date(goal.targetDate).toISOString().slice(0, 10) : 'none set'}`);
  if (calc.daysRemaining != null) lines.push(`- Days remaining: ${calc.daysRemaining}`);
  if (goal.type === 'DEBT_PAYOFF') {
    lines.push(`- Interest rate: ${goal.interestRate != null ? goal.interestRate + '% / year' : 'not provided'}`);
    lines.push(`- Minimum payment: ${goal.minimumPayment != null ? money(goal.minimumPayment) : 'not provided'}`);
  }
  lines.push('');
  lines.push(`REAL FINANCIAL CONTEXT (from the user's Xpend data${context.hasData ? '' : ' — NO transaction history available'})`);
  if (context.hasData) {
    lines.push(`- Months of history analyzed: ${context.monthsAnalyzed}`);
    lines.push(`- Average monthly income: ${money(context.avgMonthlyIncome)}`);
    lines.push(`- Average monthly expenses: ${money(context.avgMonthlyExpenses)}`);
    lines.push(`- Average monthly surplus: ${money(context.avgMonthlySurplus)}`);
    lines.push(`- Monthly subscription cost: ${money(context.monthlySubscriptionCost)}`);
    lines.push(`- Estimated total balance: ${money(context.estimatedTotalBalance)}`);
    if (context.topExpenseCategories.length) {
      lines.push(`- Top expense categories (monthly avg): ${context.topExpenseCategories.map((c) => `${c.name} ${money(c.monthlyAvg)}`).join(', ')}`);
    }
    if (context.otherActiveGoals.length) {
      lines.push(`- Other active goals competing for surplus: ${context.otherActiveGoals.map((g) => `${g.name}${g.requiredMonthly != null ? ` (${money(g.requiredMonthly)}/mo)` : ''}`).join(', ')}`);
    }
  } else {
    lines.push(`- There is no transaction history. State clearly in every plan's assumptions that income, expenses, and surplus are unknown and were not used.`);
  }
  lines.push('');
  lines.push(`PRE-COMPUTED PLAN TARGETS (these numbers are fixed — do NOT change or recompute them)`);
  for (const t of targets) {
    lines.push(`- ${t.planType}: ${money(t.monthlyTarget)}/month, ${money(t.weeklyTarget)}/week, ${money(t.dailyTarget)}/day; projected completion ${t.projectedCompletionDate?.slice(0, 10)}${t.assumedHorizon ? ' (assumes a 12-month horizon since no target date was set)' : ''}`);
  }
  lines.push('');
  lines.push(`RULES`);
  lines.push(`- Do not invent income, balances, interest rates, or dates. Use only the numbers above.`);
  lines.push(`- The monthly/weekly/daily amounts are calculations; your job is the recommendation narrative around them.`);
  lines.push(`- When data is missing, state the assumption explicitly in the "assumptions" array.`);
  lines.push(`- recommendedSpendingChanges should reference the real top expense categories when available, with realistic amounts that don't exceed those categories.`);
  lines.push(`- Assess targetDateFeasibility honestly given the surplus vs. required monthly amount.`);
  lines.push(`- riskLevel: low if the required monthly amount is comfortably within surplus, high if it exceeds surplus or no surplus data exists.`);
  lines.push('');
  lines.push(`Return one plan object for each of CONSERVATIVE, BALANCED, and AGGRESSIVE.`);

  return lines.join('\n');
}

export interface GeneratePlansArgs {
  goal: Goal;
  context: GoalAiContext;
  apiKey: string;
  model?: string | null;
}

/**
 * Generate the three AI plans: deterministic targets + AI narrative merged.
 */
export async function generateGoalAiPlans({
  goal,
  context,
  apiKey,
  model,
}: GeneratePlansArgs): Promise<GeneratedGoalPlan[]> {
  const calc = computeGoalProgress(goal);
  const targets = computePlanTargets(goal, calc);

  const openrouter = createOpenRouter({ apiKey });
  const languageModel = openrouter(model || DEFAULT_CHAT_MODEL);

  const { object } = await generateObject({
    model: languageModel,
    schema: responseSchema,
    prompt: buildPrompt(goal, calc, context, targets),
  });

  const narrativeByType = new Map(object.plans.map((p) => [p.planType, p]));

  return targets.map((target) => {
    const narrative = narrativeByType.get(target.planType as 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE');
    return {
      ...target,
      summary: narrative?.summary ?? '',
      targetDateFeasibility: narrative?.targetDateFeasibility ?? '',
      riskLevel: narrative?.riskLevel ?? 'medium',
      assumptions: narrative?.assumptions ?? [],
      recommendedSpendingChanges: narrative?.recommendedSpendingChanges ?? [],
      incomeIncreaseIdeas: narrative?.incomeIncreaseIdeas ?? [],
      nextSteps: narrative?.nextSteps ?? [],
    };
  });
}
