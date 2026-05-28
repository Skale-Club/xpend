'use client';

import Link from 'next/link';
import {
  PiggyBank,
  Plane,
  TrendingDown,
  ShoppingBag,
  ShieldCheck,
  Target,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import { computeGoalProgress } from '@/lib/goals/calculations';
import { computeRiskStatus } from '@/lib/goals/status';
import { GOAL_TYPE_LABELS, GOAL_RISK_LABELS, type Goal } from '@/lib/goals/types';
import { GoalProgress } from './GoalProgress';
import { riskBadgeVariant } from './goalDisplay';

const TYPE_ICONS: Record<Goal['type'], LucideIcon> = {
  SAVINGS: PiggyBank,
  TRAVEL: Plane,
  DEBT_PAYOFF: TrendingDown,
  PURCHASE: ShoppingBag,
  EMERGENCY_FUND: ShieldCheck,
};

interface GoalCardProps {
  goal: Goal;
}

export function GoalCard({ goal }: GoalCardProps) {
  const { hideSensitiveValues } = useSensitiveValues();
  const calc = computeGoalProgress(goal);
  const risk = computeRiskStatus(goal, calc);
  const Icon = TYPE_ICONS[goal.type] ?? Target;

  return (
    <Link
      href={`/goals/${goal.id}`}
      className="block rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold leading-tight text-foreground">{goal.name}</p>
            <p className="text-xs text-muted-foreground">{GOAL_TYPE_LABELS[goal.type]}</p>
          </div>
        </div>
        <Badge variant={riskBadgeVariant(risk)}>{GOAL_RISK_LABELS[risk]}</Badge>
      </div>

      <div className="mt-4">
        <GoalProgress
          current={goal.currentAmount}
          target={goal.targetAmount}
          calc={calc}
          risk={risk}
        />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Required / month
          </p>
          <p className={cn('text-lg font-bold', calc.requiredMonthly == null ? 'text-muted-foreground' : 'text-foreground')}>
            {calc.requiredMonthly == null
              ? '—'
              : formatCurrency(calc.requiredMonthly, { hideSensitiveValues })}
          </p>
        </div>
        {goal.targetDate && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {formatDate(goal.targetDate)}
          </div>
        )}
      </div>
    </Link>
  );
}
