'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardContent, Pagination, Loader } from '@/components/ui';
import { TransactionList } from '@/components/transactions';
import { DashboardFiltersPanel } from '@/components/dashboard';
import { Account, Category, DashboardFilters, TransactionType } from '@/types';

interface Transaction {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: Date;
  isRecurring: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string; color: string; icon?: string | null } | null;
  account: { name: string; color: string };
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  const fetchData = useCallback(async (options?: { silent?: boolean; page?: number }) => {
    const silent = options?.silent ?? false;
    const page = options?.page ?? currentPage;
    if (!silent) setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom.toISOString());
      if (filters.dateTo) params.set('dateTo', filters.dateTo.toISOString());
      if (filters.accountIds?.length) params.set('accountId', filters.accountIds[0]);
      if (filters.categoryIds?.length) params.set('categoryId', filters.categoryIds[0]);
      if (filters.transactionType) params.set('type', filters.transactionType);
      if (filters.minAmount) params.set('minAmount', filters.minAmount.toString());
      if (filters.maxAmount) params.set('maxAmount', filters.maxAmount.toString());
      if (filters.searchQuery) params.set('search', filters.searchQuery);

      // Add pagination params
      params.set('limit', limit.toString());
      params.set('offset', ((page - 1) * limit).toString());

      const [transactionsRes, accountsRes, categoriesRes] = await Promise.all([
        fetch(`/api/transactions?${params}`),
        fetch('/api/accounts'),
        fetch('/api/categories'),
      ]);

      const [transactionsData, accountsData, categoriesData] = await Promise.all([
        transactionsRes.json(),
        accountsRes.json(),
        categoriesRes.json(),
      ]);

      setTransactions(
        (transactionsData.transactions || []).map((t: Transaction) => ({
          ...t,
          date: new Date(t.date),
          isRecurring: t.isRecurring ?? false,
          createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
          updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
          type: t.type as TransactionType,
        }))
      );
      setTotalCount(transactionsData.pagination?.total || 0);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      if (!silent) setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, [filters, limit, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle page change
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

  const handleBulkCategorize = async (transactionIds: string[], categoryId: string | null) => {
    await fetch('/api/transactions/bulk-categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds, categoryId }),
    });
    await fetchData({ silent: true });
  };

  if (isLoading && !hasLoadedOnce) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] w-full">
        <Loader size={80} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <p className="text-gray-500 mt-1">View and categorize all your transactions</p>
      </div>

      <DashboardFiltersPanel
        accounts={accounts}
        categories={categories}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <Card>
        <CardHeader
          title="All Transactions"
          subtitle={`${totalCount} transactions found`}
          action={
            <Pagination
              currentPage={currentPage}
              totalCount={totalCount}
              pageSize={limit}
              onPageChange={handlePageChange}
            />
          }
        />
        <CardContent className="p-0">
          <TransactionList
            transactions={transactions}
            categories={categories}
            onCategorize={handleCategorize}
            onDescriptionUpdate={handleDescriptionUpdate}
            onCategorizeByKeyword={handleCategorizeByKeyword}
            onCategoryCreated={handleCategoryCreated}
            onBulkCategorize={handleBulkCategorize}
          />
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <Pagination
              currentPage={currentPage}
              totalCount={totalCount}
              pageSize={limit}
              onPageChange={handlePageChange}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
