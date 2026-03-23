'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Tag } from 'lucide-react';
import { Card, CardHeader, CardContent, Pagination, Loader, Modal, ExportButton, Button } from '@/components/ui';
import {
  StatsCards,
  MonthlyChart,
  DashboardFiltersPanel,
  BalanceTrendChart,
  DistributionCarousel,
  SpendingPaceCard,
  CashFlowResultCard,
  NetWorthCard,
} from '@/components/dashboard';
import { TransactionList } from '@/components/transactions';
import { CategoryTreeSelector } from '@/components/categories/CategoryTreeSelector';
import { Account, Category, DashboardFilters, TransactionType, Transaction, DashboardData, CategoryBreakdownData } from '@/types';
import { buildDistributionTemplateItems, categorySummaryToDistribution } from '@/lib/distributionHelpers';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import { getCategoryIcon } from '@/lib/categoryIcons';
import { readArrayResponse, readObjectResponse } from '@/lib/http';

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
  const [breakdownTransactionToCategorize, setBreakdownTransactionToCategorize] = useState<CategoryBreakdownData['transactions'][number] | null>(null);
  const [selectedBreakdownCategory, setSelectedBreakdownCategory] = useState('');
  const [isSavingBreakdownCategory, setIsSavingBreakdownCategory] = useState(false);
  const [editingBreakdownDescriptionId, setEditingBreakdownDescriptionId] = useState<string | null>(null);
  const [breakdownTempDescription, setBreakdownTempDescription] = useState('');

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
        readObjectResponse<DashboardData>(dashboardRes, 'Dashboard data'),
        readArrayResponse<Account>(accountsRes, 'Accounts'),
        readArrayResponse<Category>(categoriesRes, 'Categories'),
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'INCOME':
        return <ArrowUpRight className="w-4 h-4 shrink-0 text-green-500" />;
      case 'EXPENSE':
        return <ArrowDownRight className="w-4 h-4 shrink-0 text-red-500" />;
      case 'TRANSFER':
        return <ArrowRight className="w-4 h-4 shrink-0 text-blue-500" />;
      default:
        return null;
    }
  };

  const startBreakdownDescriptionEdit = (id: string, currentDescription: string) => {
    setEditingBreakdownDescriptionId(id);
    setBreakdownTempDescription(currentDescription);
  };

  const cancelBreakdownDescriptionEdit = () => {
    setEditingBreakdownDescriptionId(null);
    setBreakdownTempDescription('');
  };

  const handleBreakdownDescriptionCommit = async (
    id: string,
    nextValue: string,
    currentDescription: string
  ) => {
    const nextDescription = nextValue.trim();
    setEditingBreakdownDescriptionId(null);
    setBreakdownTempDescription('');

    if (!nextDescription || nextDescription === currentDescription) {
      return;
    }

    try {
      await handleDescriptionUpdate(id, nextDescription);
      setCategoryBreakdownData((previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          transactions: previous.transactions.map((transaction) =>
            transaction.id === id
              ? { ...transaction, description: nextDescription }
              : transaction
          ),
        };
      });
    } catch (error) {
      console.error('Failed to update breakdown transaction description:', error);
    }
  };

  const openBreakdownTransactionCategorize = (transaction: CategoryBreakdownData['transactions'][number]) => {
    setBreakdownTransactionToCategorize(transaction);
    setSelectedBreakdownCategory(transaction.category?.id || '');
  };

  const closeBreakdownTransactionCategorize = () => {
    setBreakdownTransactionToCategorize(null);
    setSelectedBreakdownCategory('');
  };

  const handleBreakdownTransactionCategorize = async () => {
    if (!breakdownTransactionToCategorize) return;
    setIsSavingBreakdownCategory(true);
    try {
      await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: breakdownTransactionToCategorize.id,
          categoryId: selectedBreakdownCategory || null,
        }),
      });
      closeBreakdownTransactionCategorize();
      await fetchData({ silent: true });
    } catch (error) {
      console.error('Failed to categorize breakdown transaction:', error);
    } finally {
      setIsSavingBreakdownCategory(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] w-full">
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
        <CashFlowResultCard data={data.cashFlowSummary} />
        <NetWorthCard data={data.netWorthSummary} />
      </div>

      <SpendingPaceCard data={data.spendingPace} />

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
          cancelBreakdownDescriptionEdit();
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
                          <td className="px-3 py-2 text-slate-900 max-w-[220px]">
                            <div className="flex items-center gap-2 min-w-0">
                              {getTypeIcon(transaction.type)}
                              {editingBreakdownDescriptionId === transaction.id ? (
                                <input
                                  autoFocus
                                  value={breakdownTempDescription}
                                  onChange={(event) => setBreakdownTempDescription(event.target.value)}
                                  onBlur={(event) =>
                                    handleBreakdownDescriptionCommit(
                                      transaction.id,
                                      event.target.value,
                                      transaction.description
                                    )
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      event.currentTarget.blur();
                                    } else if (event.key === 'Escape') {
                                      event.preventDefault();
                                      cancelBreakdownDescriptionEdit();
                                    }
                                  }}
                                  className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startBreakdownDescriptionEdit(transaction.id, transaction.description)}
                                  className="truncate text-left hover:text-blue-600 transition-colors cursor-text"
                                  title="Edit description"
                                >
                                  {transaction.description}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {transaction.category ? (
                              (() => {
                                const CategoryIcon = getCategoryIcon(transaction.category.icon);
                                return (
                                  <button
                                    type="button"
                                    onClick={() => openBreakdownTransactionCategorize(transaction)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                                    style={{
                                      backgroundColor: `${transaction.category.color}20`,
                                      color: transaction.category.color,
                                    }}
                                    title="Change category"
                                  >
                                    <CategoryIcon className="w-3.5 h-3.5" />
                                    {transaction.subcategoryName}
                                  </button>
                                );
                              })()
                            ) : (
                              <button
                                type="button"
                                onClick={() => openBreakdownTransactionCategorize(transaction)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600"
                                title="Set category"
                              >
                                <Tag className="w-3.5 h-3.5" />
                                {transaction.subcategoryName}
                              </button>
                            )}
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

      <Modal
        isOpen={!!breakdownTransactionToCategorize}
        onClose={closeBreakdownTransactionCategorize}
        title="Change Transaction Category"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 line-clamp-2">
            {breakdownTransactionToCategorize?.description}
          </p>
          <CategoryTreeSelector
            categories={categories}
            value={selectedBreakdownCategory}
            onChange={setSelectedBreakdownCategory}
            transactionType={breakdownTransactionToCategorize?.type || null}
            allowParentSelection={false}
            includeUncategorized
            maxHeightClassName="max-h-72"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeBreakdownTransactionCategorize} disabled={isSavingBreakdownCategory}>
              Cancel
            </Button>
            <Button onClick={handleBreakdownTransactionCategorize} disabled={isSavingBreakdownCategory}>
              {isSavingBreakdownCategory ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
