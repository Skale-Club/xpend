'use client';

import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

interface StatsCardsProps {
  totalIncome: number;
  totalExpenses: number;
  totalBalance: number;
  transactionCount: number;
  incomeChange?: number;
  expenseChange?: number;
}

export function StatsCards({
  totalIncome,
  totalExpenses,
  totalBalance,
  transactionCount,
  incomeChange,
  expenseChange,
}: StatsCardsProps) {
  const { hideSensitiveValues } = useSensitiveValues();

  const stats = [
    {
      title: 'Total Income',
      value: totalIncome,
      icon: TrendingUp,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50',
      change: incomeChange,
    },
    {
      title: 'Total Expenses',
      value: totalExpenses,
      icon: TrendingDown,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
      change: expenseChange,
    },
    {
      title: 'Net Balance',
      value: totalBalance,
      icon: Wallet,
      iconColor: totalBalance >= 0 ? 'text-blue-500' : 'text-red-500',
      bgColor: totalBalance >= 0 ? 'bg-blue-50' : 'bg-red-50',
    },
    {
      title: 'Transactions',
      value: transactionCount,
      icon: ArrowUpRight,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50',
      isCount: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.title}</p>
                <p className={`text-2xl font-bold mt-1 ${stat.value < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {stat.isCount ? stat.value : formatCurrency(stat.value, { hideSensitiveValues })}
                </p>
                {stat.change !== undefined && (
                  <div className={`flex items-center gap-1 mt-1 text-sm ${
                    stat.change >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.change >= 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {Math.abs(stat.change).toFixed(1)}%
                  </div>
                )}
              </div>
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
