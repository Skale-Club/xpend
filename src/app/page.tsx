'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardContent, Pagination } from '@/components/ui';
import { StatsCards, MonthlyChart, DashboardFiltersPanel, BalanceTrendChart, DistributionCarousel } from '@/components/dashboard';
import { TransactionList } from '@/components/transactions';
import { Account, Category, DashboardFilters, TransactionType } from '@/types';
import { buildDistributionTemplateItems, categorySummaryToDistribution } from '@/lib/distributionHelpers';

interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  totalBalance: number;
  transactionCount: number;
  monthlyData: { month: string; year: number; income: number; expenses: number; balance: number }[];
  expenseCategoryData: { categoryId: string; categoryName: string; color: string; total: number; percentage: number; count: number }[];
  incomeCategoryData: { categoryId: string; categoryName: string; color: string; total: number; percentage: number; count: number }[];
  merchantData: { categoryId: string; categoryName: string; color: string; total: number; percentage: number; count: number }[];
  accountDistribution: { categoryId: string; categoryName: string; color: string; total: number; percentage: number; count: number }[];
  recurringVsOneTime: { categoryId: string; categoryName: string; color: string; total: number; percentage: number; count: number }[];
  weekdayPattern: { categoryId: string; categoryName: string; color: string; total: number; percentage: number; count: number }[];
  subcategoryData: { categoryId: string; categoryName: string; color: string; total: number; percentage: number; count: number }[];
  parentCategoryBreakdown: {
    parentId: string;
    parentName: string;
    parentColor: string;
    total: number;
    subcategories: { categoryId: string; categoryName: string; color: string; total: number; percentage: number; count: number }[];
  }[];
  balanceTrend: { month: string; balance: number }[];
  transactions: {
    id: string;
    description: string;
    amount: number;
    type: string;
    date: string;
    category: { id: string; name: string; color: string; icon?: string | null } | null;
    account: { name: string; color: string };
  }[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [isLoading, setIsLoading] = useState(true);

  // Pagination state for Recent Transactions
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const fetchData = useCallback(async (options?: { silent?: boolean; page?: number }) => {
    const silent = options?.silent ?? false;
    const page = options?.page ?? currentPage;
    if (!silent) setIsLoading(true);
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

      // Add pagination params for Recent Transactions list
      params.set('limit', limit.toString());
      params.set('offset', ((page - 1) * limit).toString());

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
      if (!silent) setIsLoading(false);
    }
  }, [filters, limit, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchData({ page: newPage });
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleCategorize = async (transactionId: string, categoryId: string | null) => {
    await fetch('/api/transactions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: transactionId, categoryId }),
    });
    await fetchData({ silent: true });
  };

  const handleDescriptionUpdate = async (transactionId: string, description: string) => {
    await fetch('/api/transactions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: transactionId, description }),
    });
    await fetchData({ silent: true });
  };

  const handleCategorizeByKeyword = async (
    keyword: string,
    categoryId: string | null,
    transactionId: string
  ) => {
    await fetch('/api/transactions/categorize-by-keyword', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, categoryId, transactionId }),
    });
    await fetchData({ silent: true });
  };

  const handleCategoryCreated = async () => {
    await fetchData({ silent: true });
  };

  if (isLoading && !data) {
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

        <DistributionCarousel
          items={buildDistributionTemplateItems({
            expenseByCategory: categorySummaryToDistribution(data.expenseCategoryData),
            expenseBySubcategory: categorySummaryToDistribution(data.subcategoryData),
            parentBreakdowns: data.parentCategoryBreakdown.map((parent) => ({
              id: `parent-breakdown-${parent.parentId}`,
              title: `${parent.parentName} Breakdown`,
              data: categorySummaryToDistribution(parent.subcategories),
            })),
            incomeByCategory: categorySummaryToDistribution(data.incomeCategoryData),
            topMerchants: categorySummaryToDistribution(data.merchantData),
            expenseByAccount: categorySummaryToDistribution(data.accountDistribution),
            recurringVsOneTime: categorySummaryToDistribution(data.recurringVsOneTime),
            expenseByWeekday: categorySummaryToDistribution(data.weekdayPattern),
          })}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader 
            title="Recent Transactions" 
            action={
              <Pagination
                currentPage={currentPage}
                totalCount={data.pagination.total}
                pageSize={limit}
                onPageChange={handlePageChange}
              />
            }
          />
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
              onDescriptionUpdate={handleDescriptionUpdate}
              onCategorizeByKeyword={handleCategorizeByKeyword}
              onCategoryCreated={handleCategoryCreated}
            />
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <Pagination
                currentPage={currentPage}
                totalCount={data.pagination.total}
                pageSize={limit}
                onPageChange={handlePageChange}
              />
            </div>
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
