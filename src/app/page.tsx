'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui';
import { StatsCards, MonthlyChart, CategoryPieChart, DashboardFiltersPanel, BalanceTrendChart } from '@/components/dashboard';
import { TransactionList } from '@/components/transactions';
import { Account, Category, DashboardFilters, TransactionType } from '@/types';

interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  totalBalance: number;
  transactionCount: number;
  monthlyData: { month: string; year: number; income: number; expenses: number; balance: number }[];
  categoryData: { categoryId: string; categoryName: string; color: string; total: number; percentage: number; count: number }[];
  balanceTrend: { month: string; balance: number }[];
  transactions: {
    id: string;
    description: string;
    amount: number;
    type: string;
    date: string;
    category: { id: string; name: string; color: string } | null;
    account: { name: string; color: string };
  }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom.toISOString());
      if (filters.dateTo) params.set('dateTo', filters.dateTo.toISOString());
      if (filters.accountIds?.length) params.set('accountIds', filters.accountIds.join(','));
      if (filters.categoryIds?.length) params.set('categoryIds', filters.categoryIds.join(','));
      if (filters.transactionType) params.set('type', filters.transactionType);
      if (filters.minAmount) params.set('minAmount', filters.minAmount.toString());
      if (filters.maxAmount) params.set('maxAmount', filters.maxAmount.toString());
      if (filters.searchQuery) params.set('search', filters.searchQuery);

      const [dashboardRes, accountsRes, categoriesRes] = await Promise.all([
        fetch(`/api/dashboard?${params}`),
        fetch('/api/accounts'),
        fetch('/api/categories'),
      ]);

      const [dashboardData, accountsData, categoriesData] = await Promise.all([
        dashboardRes.json(),
        accountsRes.json(),
        categoriesRes.json(),
      ]);

      setData(dashboardData);
      setAccounts(accountsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCategorize = async (transactionId: string, categoryId: string | null) => {
    await fetch('/api/transactions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: transactionId, categoryId }),
    });
    fetchData();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load dashboard data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your spending and income</p>
      </div>

      <DashboardFiltersPanel
        accounts={accounts}
        categories={categories}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <StatsCards
        totalIncome={data.totalIncome}
        totalExpenses={data.totalExpenses}
        totalBalance={data.totalBalance}
        transactionCount={data.transactionCount}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Monthly Overview" />
          <CardContent>
            <MonthlyChart data={data.monthlyData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Expenses by Category" />
          <CardContent>
            {data.categoryData.length > 0 ? (
              <CategoryPieChart data={data.categoryData} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No expense data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent Transactions" />
          <CardContent className="p-0">
            <TransactionList
              transactions={data.transactions.map((t) => ({
                ...t,
                date: new Date(t.date),
                createdAt: new Date(),
                updatedAt: new Date(),
                accountId: '',
                isRecurring: false,
                type: t.type as TransactionType,
                account: t.account ? { name: t.account.name, color: t.account.color } : undefined,
              }))}
              categories={categories}
              onCategorize={handleCategorize}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Balance Trend" />
          <CardContent>
            {data.balanceTrend.length > 0 ? (
              <BalanceTrendChart data={data.balanceTrend} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No balance data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
