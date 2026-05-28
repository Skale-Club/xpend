'use client';

import { cn, formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import type { GoalCalculation, GoalRiskStatus } from '@/lib/goals/types';
import { progressBarColor } from './goalDisplay';

interface GoalProgressProps {
  current: number;
  target: number;
  calc: GoalCalculation;
  risk: GoalRiskStatus;
  showAmounts?: boolean;
  className?: string;
}

export function GoalProgress({
  current,
  target,
  calc,
  risk,
  showAmounts = true,
  className,
}: GoalProgressProps) {
  const { hideSensitiveValues } = useSensitiveValues();
  const pct = Math.round(calc.percentComplete);

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', progressBarColor(risk))}
          style={{ width: `${Math.min(100, Math.max(0, calc.percentComplete))}%` }}
        />
      </div>
      {showAmounts && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">
            {formatCurrency(current, { hideSensitiveValues })}
            <span className="text-muted-foreground">
              {' '}/ {formatCurrency(target, { hideSensitiveValues })}
            </span>
          </span>
          <span className="font-semibold text-muted-foreground">{pct}%</span>
        </div>
      )}
    </div>
  );
}
