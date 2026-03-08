'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
const DAY_BUCKET_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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
  if (MONTH_BUCKET_REGEX.test(value)) {
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatBucketTooltip(value: string) {
  const date = parseBucketDate(value);
  if (MONTH_BUCKET_REGEX.test(value)) {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function TimeSeriesChart({
  mode = 'single',
  data,
  singleSeriesLabel = 'Amount',
  singleSeriesColor = '#3B82F6',
}: TimeSeriesChartProps) {
  const { hideSensitiveValues } = useSensitiveValues();

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#6B7280', fontSize: 12 }}
          tickFormatter={(value) => formatBucketLabel(String(value))}
        />
        <YAxis
          tick={{ fill: '#6B7280', fontSize: 12 }}
          tickFormatter={(value) => formatCurrencyTick(Number(value), hideSensitiveValues)}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value), { hideSensitiveValues })}
          labelFormatter={(label) => formatBucketTooltip(String(label))}
          contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px' }}
        />

        {mode === 'comparison' ? (
          <>
            <Bar dataKey="income" name="Income" fill="#16A34A" radius={[4, 4, 0, 0]} />
            <Bar dataKey="outcome" name="Outcome" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </>
        ) : (
          <Bar dataKey="amount" name={singleSeriesLabel} fill={singleSeriesColor} radius={[4, 4, 0, 0]} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
