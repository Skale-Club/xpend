'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

interface TopCategoryComparisonItem {
  categoryId: string;
  categoryName: string;
  color: string;
  currentAmount: number;
  previousAmount: number;
  variationPercentage: number | null;
}

interface TopCategoriesComparisonData {
  currentMonthLabel: string;
  previousMonthLabel: string;
  currentMonthKey: string;
  previousMonthKey: string;
  items: TopCategoryComparisonItem[];
}

interface TopCategoriesComparisonCardProps {
  data: TopCategoriesComparisonData;
  showLink?: boolean;
  monthSelection?: {
    currentMonth: string;
    previousMonth: string;
    onChange: (months: { currentMonth: string; previousMonth: string }) => void;
  };
}

function formatVariation(value: number | null) {
  if (value === null) return 'N/A';
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function buildMonthOptions(monthCount: number = 36) {
  const now = new Date();
  return Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
    };
  });
}

export function TopCategoriesComparisonCard({
  data,
  showLink = true,
  monthSelection,
}: TopCategoriesComparisonCardProps) {
  const { hideSensitiveValues } = useSensitiveValues();
  const monthOptions = buildMonthOptions();
  const maxComparisonAmount = Math.max(
    ...data.items.map((item) => Math.max(item.currentAmount, item.previousAmount)),
    0
  );

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Category comparison
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {data.currentMonthLabel} vs {data.previousMonthLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {monthSelection ? (
              <>
                <select
                  value={monthSelection.currentMonth}
                  onChange={(event) =>
                    monthSelection.onChange({
                      currentMonth: event.target.value,
                      previousMonth: monthSelection.previousMonth,
                    })
                  }
                  className="h-9 rounded-lg border border-slate-200 px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Current month"
                >
                  {monthOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={monthSelection.previousMonth}
                  onChange={(event) =>
                    monthSelection.onChange({
                      currentMonth: monthSelection.currentMonth,
                      previousMonth: event.target.value,
                    })
                  }
                  className="h-9 rounded-lg border border-slate-200 px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Compare month"
                >
                  {monthOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            {showLink ? (
              <Link
                href="/reports"
                className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700"
              >
                View more
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-4 border-b border-slate-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <div>Category</div>
          <div>Monthly comparison</div>
        </div>

        <div className="mt-1 space-y-1">
          {data.items.length === 0 ? (
            <div className="py-6 text-sm text-slate-500">No category data for these months.</div>
          ) : (
            data.items.map((item) => {
              const isDecrease = item.variationPercentage !== null && item.variationPercentage < 0;
              const isIncrease = item.variationPercentage !== null && item.variationPercentage > 0;
              const variationClass = isDecrease
                ? 'bg-emerald-50 text-emerald-700'
                : isIncrease
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-slate-100 text-slate-600';
              const currentBarClass = isDecrease ? 'bg-emerald-500' : 'bg-rose-500';
              const currentBarWidth =
                maxComparisonAmount > 0
                  ? Math.max((item.currentAmount / maxComparisonAmount) * 100, item.currentAmount > 0 ? 6 : 0)
                  : 0;
              const previousBarWidth =
                maxComparisonAmount > 0
                  ? Math.max((item.previousAmount / maxComparisonAmount) * 100, item.previousAmount > 0 ? 6 : 0)
                  : 0;

              return (
                <div key={item.categoryId} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-4 rounded-lg px-1 py-2 hover:bg-slate-50">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="truncate text-sm font-medium text-slate-800">{item.categoryName}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] uppercase tracking-wide text-slate-500 shrink-0">{data.currentMonthLabel}</span>
                        <div className="text-sm font-semibold text-slate-900">
                          {formatCurrency(item.currentAmount, { hideSensitiveValues, maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${variationClass}`}>
                        {isIncrease ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {formatVariation(item.variationPercentage)}
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100">
                      <div className={`h-2.5 rounded-full ${currentBarClass}`} style={{ width: `${currentBarWidth}%` }} />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] uppercase tracking-wide text-slate-500 shrink-0">{data.previousMonthLabel}</span>
                        <div className="text-sm font-medium text-slate-500">
                          {formatCurrency(item.previousAmount, { hideSensitiveValues, maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-slate-400/80" style={{ width: `${previousBarWidth}%` }} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
