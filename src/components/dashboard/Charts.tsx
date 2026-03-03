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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { MonthlyData, CategorySummary } from '@/types';

interface MonthlyChartProps {
  data: MonthlyData[];
}

export function MonthlyChart({ data }: MonthlyChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      label: d.month,
      income: Math.abs(d.income),
      expenses: Math.abs(d.expenses),
    }));
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="label" tick={{ fill: '#6B7280', fontSize: 12 }} />
        <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px' }}
        />
        <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface CategoryPieChartProps {
  data: CategorySummary[];
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="categoryName"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ name, value }) => `${name} ($${value})`}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface BalanceTrendChartProps {
  data: { month: string; balance: number }[];
}

export function BalanceTrendChart({ data }: BalanceTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 12 }} />
        <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px' }}
        />
        <Line
          type="monotone"
          dataKey="balance"
          name="Balance"
          stroke="#3B82F6"
          strokeWidth={2}
          dot={{ fill: '#3B82F6', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
