'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

interface NetWorthSummaryData {
  netWorth: number;
  series: { label: string; value: number }[];
}

interface NetWorthCardProps {
  data: NetWorthSummaryData;
}

const ranges = ['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as const;
type Range = (typeof ranges)[number];

export function NetWorthCard({ data }: NetWorthCardProps) {
  const { hideSensitiveValues } = useSensitiveValues();
  const [range, setRange] = useState<Range>('1W');

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Net worth
          </div>
          <Link
            href="/accounts"
            className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            View all
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-3 text-4xl font-semibold leading-none text-slate-900">
          {formatCurrency(data.netWorth, { hideSensitiveValues })}
        </div>

        <div className="mt-3 inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
          --
        </div>

        <div className="mt-4 h-28">
          {data.series.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.series}>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), { hideSensitiveValues })}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid #E2E8F0' }}
                />
                <Line type="monotone" dataKey="value" stroke="#60A5FA" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No history available
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {ranges.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                range === item ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
