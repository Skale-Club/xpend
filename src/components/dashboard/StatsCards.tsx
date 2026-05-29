'use client';

import { TrendingUp, TrendingDown, Wallet, Hash } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

interface StatsCardsProps {
  totalIncome: number;
  totalExpenses: number;
  totalBalance: number;
  transactionCount: number;
}

export function StatsCards({
  totalIncome,
  totalExpenses,
  totalBalance,
  transactionCount,
}: StatsCardsProps) {
  const { hideSensitiveValues } = useSensitiveValues();

  const stats = [
    {
      title: 'Total Income',
      value: totalIncome,
      icon: TrendingUp,
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
      valueColor: 'text-success',
    },
    {
      title: 'Total Expenses',
      value: totalExpenses,
      icon: TrendingDown,
      iconBg: 'bg-destructive/10',
      iconColor: 'text-destructive',
      valueColor: 'text-destructive',
    },
    {
      title: 'Net Balance',
      value: totalBalance,
      icon: Wallet,
      iconBg: totalBalance >= 0 ? 'bg-primary/10' : 'bg-destructive/10',
      iconColor: totalBalance >= 0 ? 'text-primary' : 'text-destructive',
      valueColor: totalBalance >= 0 ? 'text-foreground' : 'text-destructive',
    },
    {
      title: 'Transactions',
      value: transactionCount,
      icon: Hash,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      valueColor: 'text-foreground',
      isCount: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.title}
          className="bg-card rounded-xl border border-border p-5 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {stat.title}
              </p>
              <p className={`text-2xl font-bold mt-2 ${stat.valueColor}`}>
                {stat.isCount
                  ? stat.value.toLocaleString()
                  : formatCurrency(stat.value, { hideSensitiveValues })}
              </p>
            </div>
            <div className={`flex-shrink-0 rounded-lg p-2.5 ${stat.iconBg}`}>
              <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
