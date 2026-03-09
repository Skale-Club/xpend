'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardContent, Pagination, Loader, Modal, ExportButton } from '@/components/ui';
import {
  StatsCards,
  MonthlyChart,
  DashboardFiltersPanel,
  BalanceTrendChart,
  DistributionCarousel,
  SpendingPaceCard,
} from '@/components/dashboard';
import { TransactionList } from '@/components/transactions';
import { Account, Category, DashboardFilters, TransactionType, Transaction } from '@/types';
import { buildDistributionTemplateItems, categorySummaryToDistribution } from '@/lib/distributionHelpers';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

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
  spendingPace: {
    currentTotal: number;
    previousComparableTotal: number;
    previousMonthTotal: number;
    changePercentage: number | null;
    status: 'below' | 'above' | 'equal';
    currentComparableDay: number;
    chartData: {
      day: number;
      currentMonth: number | null;
      previousMonth: number | null;
    }[];
  };
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

interface CategoryBreakdownData {
  category: {
    id: string;
    name: string;
    color: string;
    total: number;
    count: number;
  };
  subcategories: {
    id: string;
    name: string;
    color: string;
    total: number;
    count: number;
    percentage: number;
  }[];
  transactions: {
    id: string;
    description: string;
    amount: number;
    date: string;
    subcategoryName: string;
    account: { id: string; name: string; color: string } | null;
  }[];
  totalTransactions: number;
  truncated: boolean;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const { hideSensitiveValues } = useSensitiveValues();

  const [isCategoryBreakdownOpen, setIsCategoryBreakdownOpen] = useState(false);
  const [isCategoryBreakdownLoading, setIsCategoryBreakdownLoading] = useState(false);
  const [categoryBreakdownData, setCategoryBreakdownData] = useState<CategoryBreakdownData | null>(null);
  const [categoryBreakdownError, setCategoryBreakdownError] = useState<string | null>(null);

  // Pagination state for Recent Transactions
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

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
        <Loader size={80} />
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of your spending and income</p>
        </div>
        <ExportButton
          transactions={data.transactions.map((t) => ({
            ...t,
            date: new Date(t.date),
            createdAt: new Date(),
            updatedAt: new Date(),
            accountId: '',
            isRecurring: false,
            type: t.type as TransactionType,
            account: t.account ? { name: t.account.name, color: t.account.color } : undefined,
          })) as Transaction[]}
          filename={`transactions-${new Date().toISOString().split('T')[0]}`}
        />
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
        <SpendingPaceCard data={data.spendingPace} />
        <div className="hidden lg:block" aria-hidden="true" />
      </div>

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
          onDataPointClick={async ({ viewId, dataPoint }) => {
            const parentCategoryId = viewId === 'expense'
              ? dataPoint.id
              : viewId.startsWith('parent-breakdown-')
                ? viewId.replace('parent-breakdown-', '')
                : null;
            if (!parentCategoryId) return;

            setIsCategoryBreakdownOpen(true);
            setIsCategoryBreakdownLoading(true);
            setCategoryBreakdownData(null);
            setCategoryBreakdownError(null);

            try {
              const params = new URLSearchParams();
              params.set('parentCategoryId', parentCategoryId);

              if (filters.dateFrom) params.set('dateFrom', filters.dateFrom.toISOString());
              if (filters.dateTo) params.set('dateTo', filters.dateTo.toISOString());
              if (filters.accountIds?.length) params.set('accountIds', filters.accountIds.join(','));
              if (filters.categoryIds?.length) params.set('categoryIds', filters.categoryIds.join(','));
              if (filters.minAmount) params.set('minAmount', filters.minAmount.toString());
              if (filters.maxAmount) params.set('maxAmount', filters.maxAmount.toString());
              if (filters.searchQuery) params.set('search', filters.searchQuery);

              const response = await fetch(`/api/dashboard/category-breakdown?${params.toString()}`);
              if (!response.ok) {
                throw new Error('Failed to load breakdown');
              }

              const breakdown = await response.json();
              setCategoryBreakdownData(breakdown);
            } catch (error) {
              console.error('Failed to fetch category breakdown:', error);
              setCategoryBreakdownError('Failed to load category breakdown');
            } finally {
              setIsCategoryBreakdownLoading(false);
            }
          }}
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

      <Modal
        isOpen={isCategoryBreakdownOpen}
        onClose={() => {
          setIsCategoryBreakdownOpen(false);
          setCategoryBreakdownData(null);
          setCategoryBreakdownError(null);
        }}
        title={categoryBreakdownData ? `${categoryBreakdownData.category.name} Breakdown` : 'Category Breakdown'}
        size="xl"
      >
        {isCategoryBreakdownLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader size={56} />
          </div>
        ) : categoryBreakdownError ? (
          <div className="py-8 text-center text-sm text-red-600">
            {categoryBreakdownError}
          </div>
        ) : categoryBreakdownData ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</div>
                <div className="text-base font-bold text-slate-900">
                  {formatCurrency(categoryBreakdownData.category.total, { hideSensitiveValues })}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transactions</div>
                <div className="text-base font-bold text-slate-900">{categoryBreakdownData.totalTransactions}</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Subcategories</h3>
              <div className="space-y-2">
                {categoryBreakdownData.subcategories.length === 0 ? (
                  <div className="rounded-lg border border-slate-100 px-3 py-4 text-sm text-slate-500">
                    No subcategories found.
                  </div>
                ) : (
                  categoryBreakdownData.subcategories.map((subcategory) => (
                    <div key={subcategory.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: subcategory.color }} />
                        <span className="text-sm text-slate-800 truncate">{subcategory.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold text-slate-900">
                          {formatCurrency(subcategory.total, { hideSensitiveValues })}
                        </span>
                        <span className="text-xs text-slate-500 min-w-[3rem] text-right">
                          {subcategory.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Related Transactions</h3>
              <div className="max-h-[320px] overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 bg-slate-50 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium">Subcategory</th>
                      <th className="px-3 py-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categoryBreakdownData.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                          No transactions found for this category.
                        </td>
                      </tr>
                    ) : (
                      categoryBreakdownData.transactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDate(transaction.date)}</td>
                          <td className="px-3 py-2 text-slate-900 max-w-[220px] truncate">{transaction.description}</td>
                          <td className="px-3 py-2">
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                              {transaction.subcategoryName}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900 whitespace-nowrap">
                            {formatCurrency(transaction.amount, { hideSensitiveValues })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {categoryBreakdownData.truncated && (
                <p className="mt-2 text-xs text-slate-500">
                  Showing the 100 most recent transactions for this category.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">
            Select a category to view details.
          </div>
        )}
      </Modal>
    </div>
  );
}
