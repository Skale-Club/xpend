'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui';
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
  category: { id: string; name: string; color: string } | null;
  account: { name: string; color: string };
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
      if (filters.accountIds?.length) params.set('accountId', filters.accountIds[0]);
      if (filters.categoryIds?.length) params.set('categoryId', filters.categoryIds[0]);
      if (filters.transactionType) params.set('type', filters.transactionType);
      if (filters.minAmount) params.set('minAmount', filters.minAmount.toString());
      if (filters.maxAmount) params.set('maxAmount', filters.maxAmount.toString());
      if (filters.searchQuery) params.set('search', filters.searchQuery);

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
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
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

  const handleBulkCategorize = async (transactionIds: string[], categoryId: string | null) => {
    await fetch('/api/transactions/bulk-categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds, categoryId }),
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
          subtitle={`${transactions.length} transactions found`}
        />
        <CardContent className="p-0">
          <TransactionList
            transactions={transactions}
            categories={categories}
            onCategorize={handleCategorize}
            onBulkCategorize={handleBulkCategorize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
