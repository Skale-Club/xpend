'use client';

import Link from 'next/link';
import { ArrowUpRight, Info } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

interface SpendingPaceDataPoint {
  day: number;
  currentMonth: number | null;
  previousMonth: number | null;
}

interface SpendingPaceData {
  currentTotal: number;
  previousComparableTotal: number;
  changePercentage: number | null;
  status: 'below' | 'above' | 'equal';
  currentComparableDay: number;
  currentMonthLabel: string;
  previousMonthLabel: string;
  chartData: SpendingPaceDataPoint[];
}

interface SpendingPaceCardProps {
  data: SpendingPaceData;
}

function formatCompactCurrency(value: number, hideSensitiveValues: boolean): string {
  if (hideSensitiveValues) {
    return '****';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 0,
  }).format(value);
}

export function SpendingPaceCard({ data }: SpendingPaceCardProps) {
  const { hideSensitiveValues } = useSensitiveValues();

  const variationIsPositive = (data.changePercentage ?? 0) <= 0;
  const variationClass = variationIsPositive
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-rose-100 text-rose-700';
  const statusLabel =
    data.status === 'below'
      ? 'below'
      : data.status === 'above'
        ? 'above'
        : 'equal';

  const axisTicks = [1, 5, 10, 15, 20, 25, 31].filter((tick) => tick <= data.chartData.length);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Spending pace
            <Info className="h-3.5 w-3.5" />
          </div>
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            View all
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-3 flex items-end gap-2">
          <div className="text-4xl font-semibold leading-none text-slate-900">
            {formatCurrency(data.currentTotal, { hideSensitiveValues, maximumFractionDigits: 0 })}
          </div>
          <div className="pb-1 text-2xl font-medium leading-none text-slate-700">{statusLabel}</div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded-md px-2.5 py-1 font-semibold ${variationClass}`}>
            {data.changePercentage === null
              ? 'N/A'
              : `${data.changePercentage > 0 ? '+' : ''}${data.changePercentage.toFixed(1)}%`}
          </span>
          <span className="text-slate-500">
            vs {formatCurrency(data.previousComparableTotal, { hideSensitiveValues, maximumFractionDigits: 0 })}{' '}
            {data.previousMonthLabel}
          </span>
        </div>

        <div className="mt-4 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.chartData} margin={{ top: 8, right: 8, left: 6, bottom: 0 }}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="day"
                ticks={axisTicks}
                tick={{ fill: '#64748B', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: '#64748B', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCompactCurrency(Number(value), hideSensitiveValues)}
              />
              <Tooltip
                formatter={(value: number | string, name: string) => [
                  formatCurrency(Number(value), { hideSensitiveValues, maximumFractionDigits: 0 }),
                  name === 'currentMonth' ? data.currentMonthLabel : data.previousMonthLabel,
                ]}
                labelFormatter={(label) => `Day ${label}`}
                contentStyle={{
                  borderRadius: '0.75rem',
                  border: '1px solid #E2E8F0',
                }}
              />
              <Line
                type="monotone"
                dataKey="previousMonth"
                stroke="#9CA3AF"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="currentMonth"
                stroke="#22C55E"
                strokeWidth={2.5}
                connectNulls={false}
                dot={({ cx, cy, payload }) =>
                  payload.day === data.currentComparableDay && payload.currentMonth !== null ? (
                    <circle cx={cx} cy={cy} r={5} fill="#22C55E" stroke="#fff" strokeWidth={2} />
                  ) : (
                    <></>
                  )
                }
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex items-center gap-5 text-xs text-slate-500">
          <div className="inline-flex items-center gap-1.5">
            <span className="h-2 w-6 rounded-full bg-green-500" />
            {data.currentMonthLabel}
          </div>
          <div className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-6 border-t border-dashed border-slate-400" />
            {data.previousMonthLabel}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
