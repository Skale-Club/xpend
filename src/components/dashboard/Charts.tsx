'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Cell,
} from 'recharts';
import { formatCurrency, formatCurrencyTick } from '@/lib/utils';
import { MonthlyData } from '@/types';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

/* Reusable chart style helpers — reads CSS variables so they follow the theme */
const CHART_GRID_STROKE = 'var(--border)';
const CHART_TICK_FILL = 'var(--muted-foreground)';
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--foreground)',
  fontSize: '13px',
};

/* Finance palette */
const INCOME_COLOR   = 'var(--chart-2)'; // green
const EXPENSE_COLOR  = 'var(--chart-5)'; // red
const BALANCE_COLOR  = 'var(--chart-1)'; // blue

interface MonthlyChartProps {
  data: MonthlyData[];
}

export function MonthlyChart({ data }: MonthlyChartProps) {
  const { hideSensitiveValues } = useSensitiveValues();

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: d.month,
        income: Math.abs(d.income),
        expenses: Math.abs(d.expenses),
      })),
    [data],
  );

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: CHART_TICK_FILL, fontSize: 12 }}
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
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_TICK_FILL }} />
        <Bar dataKey="income"   name="Income"   fill={INCOME_COLOR}  radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface BalanceTrendChartProps {
  data: { month: string; balance: number }[];
}

export function BalanceTrendChart({ data }: BalanceTrendChartProps) {
  const { hideSensitiveValues } = useSensitiveValues();

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: CHART_TICK_FILL, fontSize: 12 }}
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
          contentStyle={TOOLTIP_STYLE}
        />
        <Line
          type="monotone"
          dataKey="balance"
          name="Balance"
          stroke={BALANCE_COLOR}
          strokeWidth={2.5}
          dot={{ fill: BALANCE_COLOR, strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface CategorySpendingBarChartProps {
  data: { name: string; value: number; color: string }[];
}

export function CategorySpendingBarChart({ data }: CategorySpendingBarChartProps) {
  const { hideSensitiveValues } = useSensitiveValues();

  // One row per category, ~44px tall, so the chart grows with the data.
  const height = Math.max(160, data.length * 44 + 24);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        barCategoryGap="20%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: CHART_TICK_FILL, fontSize: 12 }}
          tickFormatter={(v) => formatCurrencyTick(Number(v), hideSensitiveValues)}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: CHART_TICK_FILL, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value), { hideSensitiveValues })}
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
        />
        <Bar dataKey="value" name="Spent" radius={[0, 4, 4, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
