'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency, formatCurrencyTick } from '@/lib/utils';
import { ReportData } from '@/types';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

type AmountSeriesPoint = ReportData['timeSeries'][number];
type IncomeVsOutcomePoint = ReportData['incomeVsOutcomeSeries'][number];

interface TimeSeriesChartProps {
  mode?: 'single' | 'comparison';
  data: AmountSeriesPoint[] | IncomeVsOutcomePoint[];
  singleSeriesLabel?: string;
  singleSeriesColor?: string;
}

const MONTH_BUCKET_REGEX = /^\d{4}-\d{2}$/;
const DAY_BUCKET_REGEX   = /^\d{4}-\d{2}-\d{2}$/;

function parseBucketDate(value: string) {
  if (DAY_BUCKET_REGEX.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  if (MONTH_BUCKET_REGEX.test(value)) {
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }
  return new Date(value);
}

function formatBucketLabel(value: string) {
  const date = parseBucketDate(value);
  if (MONTH_BUCKET_REGEX.test(value))
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatBucketTooltip(value: string) {
  const date = parseBucketDate(value);
  if (MONTH_BUCKET_REGEX.test(value))
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

const CHART_GRID_STROKE = 'var(--border)';
const CHART_TICK_FILL   = 'var(--muted-foreground)';
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--foreground)',
  fontSize: '13px',
};

export function TimeSeriesChart({
  mode = 'single',
  data,
  singleSeriesLabel = 'Amount',
  singleSeriesColor = 'var(--chart-1)',
}: TimeSeriesChartProps) {
  const { hideSensitiveValues } = useSensitiveValues();

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: CHART_TICK_FILL, fontSize: 12 }}
          tickFormatter={(v) => formatBucketLabel(String(v))}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: CHART_TICK_FILL, fontSize: 12 }}
          tickFormatter={(v) => formatCurrencyTick(Number(v), hideSensitiveValues)}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value), { hideSensitiveValues })}
          labelFormatter={(label) => formatBucketTooltip(String(label))}
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
        />
        {mode === 'comparison' ? (
          <>
            <Legend wrapperStyle={{ fontSize: 12, color: CHART_TICK_FILL }} />
            <Bar dataKey="income"  name="Income"  fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="outcome" name="Outcome" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
          </>
        ) : (
          <Bar dataKey="amount" name={singleSeriesLabel} fill={singleSeriesColor} radius={[4, 4, 0, 0]} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
