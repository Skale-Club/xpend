'use client';

import { useState, useCallback } from 'react';
import { Layers } from 'lucide-react';
import { Button, Input, useToast } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import type { DebtStrategyResult } from '@/lib/goals/debtPayoff';
import { formatMonths } from './GoalDebtPayoff';

interface DebtStrategyResponse {
  debtCount: number;
  totalBalance: number;
  extra: number;
  snowball: DebtStrategyResult;
  avalanche: DebtStrategyResult;
}

export function DebtStrategyPanel() {
  const toast = useToast();
  const { hideSensitiveValues } = useSensitiveValues();
  const [extra, setExtra] = useState(0);
  const [result, setResult] = useState<DebtStrategyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const compute = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/goals/debt-strategy?extra=${encodeURIComponent(extra)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to compute strategy');
      setResult(data);
    } catch (error) {
      console.error('Failed to compute debt strategy:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to compute strategy');
    } finally {
      setIsLoading(false);
    }
  }, [extra, toast]);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Layers className="h-4 w-4 text-primary" />
            Debt Payoff Strategy
          </p>
          <p className="text-xs text-muted-foreground">
            Compare snowball (smallest balance first) vs. avalanche (highest rate first) across your active debts.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-40">
            <Input
              label="Extra / month"
              type="number"
              step="0.01"
              min="0"
              value={extra}
              onChange={(e) => setExtra(parseFloat(e.target.value) || 0)}
            />
          </div>
          <Button onClick={compute} isLoading={isLoading}>
            Compare
          </Button>
        </div>
      </div>

      {result && result.debtCount > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StrategyCard
            title="Snowball"
            subtitle="Smallest balance first"
            data={result.snowball}
            hideSensitiveValues={hideSensitiveValues}
          />
          <StrategyCard
            title="Avalanche"
            subtitle="Highest interest first"
            data={result.avalanche}
            hideSensitiveValues={hideSensitiveValues}
          />
        </div>
      )}

      {result && result.debtCount === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          No active debt goals with a remaining balance to plan.
        </p>
      )}
    </div>
  );
}

function StrategyCard({
  title,
  subtitle,
  data,
  hideSensitiveValues,
}: {
  title: string;
  subtitle: string;
  data: DebtStrategyResult;
  hideSensitiveValues: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>

      {data.paidOff ? (
        <div className="mt-3 flex gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Payoff time</p>
            <p className="text-sm font-bold text-foreground">{formatMonths(data.totalMonths)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total interest</p>
            <p className="text-sm font-bold text-foreground">
              {formatCurrency(data.totalInterest, { hideSensitiveValues })}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-destructive">
          Not payable with the current budget — add more per month.
        </p>
      )}

      {data.order.length > 0 && (
        <ol className="mt-3 space-y-1 text-sm">
          {data.order.map((d, i) => (
            <li key={d.id} className="flex items-center justify-between text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{i + 1}.</span> {d.name}
              </span>
              <span>{d.payoffMonth != null ? formatMonths(d.payoffMonth) : '—'}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
