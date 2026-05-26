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
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
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

        <div className="mt-3 text-4xl font-semibold leading-none text-foreground">
          {formatCurrency(data.netWorth, { hideSensitiveValues })}
        </div>

        <div className="mt-3 inline-flex rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
          --
        </div>

        <div className="mt-4 h-28">
          {data.series.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.series}>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), { hideSensitiveValues })}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)', fontSize: '13px' }}
                />
                <Line type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
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
                range === item ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted'
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
