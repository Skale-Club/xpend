'use client';

import { TrendingDown, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import { computeGoalProgress } from '@/lib/goals/calculations';
import { debtPayoffSummary } from '@/lib/goals/debtPayoff';
import type { Goal } from '@/lib/goals/types';

export function formatMonths(months: number | null): string {
  if (months == null) return 'Never';
  if (months === 0) return 'Now';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} mo`;
  if (rem === 0) return `${years} yr`;
  return `${years} yr ${rem} mo`;
}

interface GoalDebtPayoffProps {
  goal: Goal;
}

export function GoalDebtPayoff({ goal }: GoalDebtPayoffProps) {
  const { hideSensitiveValues } = useSensitiveValues();
  const calc = computeGoalProgress(goal);
  const summary = debtPayoffSummary(goal, calc);

  const min = summary.minimumScenario;
  const minNeverPays = summary.minimumPayment != null && min?.months == null;

  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <TrendingDown className="h-4 w-4 text-primary" />
        Debt Payoff
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Balance" value={formatCurrency(summary.balance, { hideSensitiveValues })} />
        <Stat label="Interest rate" value={summary.annualRate > 0 ? `${summary.annualRate}% / yr` : 'Not set'} />
        <Stat
          label="Min. payment"
          value={summary.minimumPayment != null ? formatCurrency(summary.minimumPayment, { hideSensitiveValues }) : 'Not set'}
        />
        <Stat
          label="Required for date"
          value={summary.requiredForTargetDate != null
            ? `${formatCurrency(summary.requiredForTargetDate, { hideSensitiveValues })}/mo`
            : '—'}
        />
      </div>

      {/* Minimum-payment scenario */}
      {summary.minimumPayment != null && (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            If you only pay the minimum
          </p>
          {minNeverPays ? (
            <div className="mt-2 flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                The minimum payment doesn&apos;t cover the monthly interest — the balance would never
                be paid off. Increase the payment to make progress.
              </span>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span>
                Time to payoff:{' '}
                <span className="font-bold text-foreground">{formatMonths(min?.months ?? null)}</span>
              </span>
              {min?.payoffDate && (
                <span className="text-muted-foreground">by {formatDate(min.payoffDate)}</span>
              )}
              <span>
                Total interest:{' '}
                <span className="font-bold text-foreground">
                  {min ? formatCurrency(min.totalInterest, { hideSensitiveValues }) : '—'}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Risk vs target date */}
      {summary.requiredForTargetDate != null && summary.minimumPayment != null && !minNeverPays && (
        <div className="mt-3">
          {summary.minimumPayment >= summary.requiredForTargetDate ? (
            <Badge variant="success">Minimum payment meets the target date</Badge>
          ) : (
            <Badge variant="warning">
              Minimum is below the {formatCurrency(summary.requiredForTargetDate, { hideSensitiveValues })}/mo needed for the target date
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
