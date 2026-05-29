'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Card, CardContent } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

interface NetWorthSummaryData {
  netWorth: number;
  series: { date: string; value: number }[];
}

interface NetWorthCardProps {
  data: NetWorthSummaryData;
}

const ranges = ['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as const;
type Range = (typeof ranges)[number];

/* Days of history each range looks back over. YTD/ALL are computed specially. */
const RANGE_DAYS: Record<Exclude<Range, 'YTD' | 'ALL'>, number> = {
  '1D': 1,
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '1Y': 365,
};

function rangeCutoff(range: Range): Date | null {
  if (range === 'ALL') return null;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  if (range === 'YTD') {
    cutoff.setMonth(0, 1);
    return cutoff;
  }
  cutoff.setDate(cutoff.getDate() - RANGE_DAYS[range]);
  return cutoff;
}

export function NetWorthCard({ data }: NetWorthCardProps) {
  const { hideSensitiveValues } = useSensitiveValues();
  const [range, setRange] = useState<Range>('1M');

  const filtered = useMemo(() => {
    const cutoff = rangeCutoff(range);
    if (!cutoff) return data.series;
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    const sliced = data.series.filter((point) => point.date >= cutoffKey);
    // Keep one anchor point before the window so the line has a baseline to move from.
    if (sliced.length < 2 && data.series.length >= 2) {
      return data.series.slice(-2);
    }
    return sliced;
  }, [data.series, range]);

  const change = useMemo(() => {
    if (filtered.length < 2) return null;
    const first = filtered[0].value;
    const last = filtered[filtered.length - 1].value;
    const delta = last - first;
    const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : null;
    return { delta, pct };
  }, [filtered]);

  const isUp = change ? change.delta > 0 : false;
  const isDown = change ? change.delta < 0 : false;
  const changeColor = isUp
    ? 'bg-success/10 text-success'
    : isDown
      ? 'bg-destructive/10 text-destructive'
      : 'bg-muted text-muted-foreground';
  const ChangeIcon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : ArrowRight;
  const lineColor = isDown ? 'var(--chart-5)' : 'var(--chart-2)';

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

        <div className={`mt-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${changeColor}`}>
          {change ? (
            <>
              <ChangeIcon className="h-3.5 w-3.5" />
              <span>
                {change.delta >= 0 ? '+' : '-'}
                {formatCurrency(Math.abs(change.delta), { hideSensitiveValues })}
              </span>
              {change.pct !== null && (
                <span className="opacity-80">
                  ({change.delta >= 0 ? '+' : '-'}
                  {Math.abs(change.pct).toFixed(1)}%)
                </span>
              )}
              <span className="opacity-60">· {range}</span>
            </>
          ) : (
            <span>--</span>
          )}
        </div>

        <div className="mt-4 h-28">
          {filtered.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filtered}>
                <XAxis dataKey="date" hide />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), { hideSensitiveValues })}
                  labelFormatter={(label) =>
                    new Date(`${label}T00:00:00`).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  }
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)', fontSize: '13px' }}
                />
                <Line type="monotone" dataKey="value" stroke={lineColor} strokeWidth={2.5} dot={false} />
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
