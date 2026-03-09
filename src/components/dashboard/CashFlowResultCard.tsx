'use client';

import Link from 'next/link';
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

interface CashFlowSummaryData {
  currentMonthLabel: string;
  previousMonthLabel: string;
  netAmount: number;
  previousNetAmount: number;
  incomeAmount: number;
  expenseAmount: number;
  transferAmount: number;
  changePercentage: number | null;
}

interface CashFlowResultCardProps {
  data: CashFlowSummaryData;
}

function formatChange(change: number | null) {
  if (change === null) return 'N/A';
  const rounded = Math.abs(change).toFixed(1);
  return `${change >= 0 ? '+' : '-'}${rounded}%`;
}

export function CashFlowResultCard({ data }: CashFlowResultCardProps) {
  const { hideSensitiveValues } = useSensitiveValues();
  const isPositive = (data.changePercentage ?? 0) >= 0;
  const badgeClass = isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
  const ratio = data.incomeAmount > 0 ? Math.min((data.expenseAmount / data.incomeAmount) * 100, 100) : 0;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Partial result
          </div>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            Cash flow
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-3 text-4xl font-semibold leading-none text-slate-900">
          {formatCurrency(data.netAmount, { hideSensitiveValues })}
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold ${badgeClass}`}>
            {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {formatChange(data.changePercentage)}
          </span>
          <span className="text-slate-500">
            vs {formatCurrency(data.previousNetAmount, { hideSensitiveValues, maximumFractionDigits: 0 })} {data.previousMonthLabel}
          </span>
        </div>

        <div className="mt-4 h-2 w-full rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-blue-400" style={{ width: `${ratio}%` }} />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Income</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {formatCurrency(data.incomeAmount, { hideSensitiveValues, maximumFractionDigits: 0 })}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Spent</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {formatCurrency(data.expenseAmount, { hideSensitiveValues, maximumFractionDigits: 0 })}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Transfer</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {formatCurrency(data.transferAmount, { hideSensitiveValues, maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
