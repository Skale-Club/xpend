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
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { ReportData } from '@/types';

interface TimeSeriesChartProps {
  data: ReportData['timeSeries'];
}

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis 
          dataKey="date" 
          tick={{ fill: '#6B7280', fontSize: 12 }} 
          tickFormatter={(value) => {
            const date = new Date(value);
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          }}
        />
        <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          labelFormatter={(label) => new Date(label as string).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
          contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px' }}
        />
        <Bar dataKey="amount" name="Amount" fill="#3B82F6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
