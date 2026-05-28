'use client';

import { ReactNode } from 'react';
import { Badge } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import type { GoalPlanType, StoredGoalPlan, GeneratedGoalPlan } from '@/lib/goals/types';

const PLAN_LABELS: Record<string, string> = {
  CONSERVATIVE: 'Conservative',
  BALANCED: 'Balanced',
  AGGRESSIVE: 'Aggressive',
  CUSTOM: 'Custom',
};

type RiskLevel = 'low' | 'medium' | 'high';

export interface PlanView {
  planType: GoalPlanType | string;
  monthlyTarget: number | null;
  weeklyTarget: number | null;
  dailyTarget: number | null;
  projectedCompletionDate: string | Date | null;
  summary?: string;
  targetDateFeasibility?: string;
  riskLevel?: RiskLevel | string | null;
  assumptions?: string[];
  recommendedSpendingChanges?: string[];
  incomeIncreaseIdeas?: string[];
  nextSteps?: string[];
  assumedHorizon?: boolean;
}

// Convert a database plan snapshot into the unified PlanView shape.
export function normalizeStoredPlan(plan: StoredGoalPlan): PlanView {
  let assumptions: string[] = [];
  let rec: Record<string, unknown> = {};
  try {
    if (plan.assumptionsJson) assumptions = JSON.parse(plan.assumptionsJson);
  } catch { /* ignore malformed json */ }
  try {
    if (plan.recommendationsJson) rec = JSON.parse(plan.recommendationsJson);
  } catch { /* ignore malformed json */ }

  return {
    planType: plan.planType,
    monthlyTarget: plan.monthlyTarget,
    weeklyTarget: plan.weeklyTarget,
    dailyTarget: plan.dailyTarget,
    projectedCompletionDate: plan.projectedCompletionDate,
    summary: (rec.summary as string) || undefined,
    targetDateFeasibility: (rec.targetDateFeasibility as string) || undefined,
    riskLevel: (rec.riskLevel as string) || undefined,
    assumptions,
    recommendedSpendingChanges: (rec.recommendedSpendingChanges as string[]) || [],
    incomeIncreaseIdeas: (rec.incomeIncreaseIdeas as string[]) || [],
    nextSteps: (rec.nextSteps as string[]) || [],
  };
}

export function generatedToView(plan: GeneratedGoalPlan): PlanView {
  return plan;
}

function riskVariant(risk?: string | null): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (risk) {
    case 'low':
      return 'success';
    case 'medium':
      return 'warning';
    case 'high':
      return 'destructive';
    default:
      return 'secondary';
  }
}

interface GoalPlanCardProps {
  plan: PlanView;
  createdAt?: string | Date;
  footer?: ReactNode;
}

function Section({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-foreground">
            <span className="text-muted-foreground">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GoalPlanCard({ plan, createdAt, footer }: GoalPlanCardProps) {
  const { hideSensitiveValues } = useSensitiveValues();
  const fmt = (v: number | null | undefined) =>
    v == null ? '—' : formatCurrency(v, { hideSensitiveValues });

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground">
            {PLAN_LABELS[plan.planType] ?? plan.planType} plan
          </p>
          {plan.riskLevel && (
            <Badge variant={riskVariant(plan.riskLevel)}>{plan.riskLevel} risk</Badge>
          )}
        </div>
        {createdAt && (
          <span className="text-xs text-muted-foreground">{formatDate(createdAt)}</span>
        )}
      </div>

      {plan.summary && <p className="mt-2 text-sm text-muted-foreground">{plan.summary}</p>}

      <div className="mt-3 grid grid-cols-3 gap-3 border-y border-border py-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">/ month</p>
          <p className="text-sm font-bold text-foreground">{fmt(plan.monthlyTarget)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">/ week</p>
          <p className="text-sm font-bold text-foreground">{fmt(plan.weeklyTarget)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">/ day</p>
          <p className="text-sm font-bold text-foreground">{fmt(plan.dailyTarget)}</p>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {plan.projectedCompletionDate && (
          <p className="text-xs text-muted-foreground">
            Projected completion: {formatDate(plan.projectedCompletionDate)}
            {plan.assumedHorizon ? ' (assumes a 12-month horizon)' : ''}
          </p>
        )}
        {plan.targetDateFeasibility && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feasibility</p>
            <p className="mt-1 text-sm text-foreground">{plan.targetDateFeasibility}</p>
          </div>
        )}
        <Section title="Assumptions" items={plan.assumptions} />
        <Section title="Recommended spending changes" items={plan.recommendedSpendingChanges} />
        <Section title="Income increase ideas" items={plan.incomeIncreaseIdeas} />
        <Section title="Next steps" items={plan.nextSteps} />
      </div>

      {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
    </div>
  );
}
