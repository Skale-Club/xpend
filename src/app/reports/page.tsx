'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardHeader, CardContent, Modal, Button, Loader } from '@/components/ui';
import { DashboardFiltersPanel, DistributionCarousel } from '@/components/dashboard';
import { CategoryTreeSelector } from '@/components/categories/CategoryTreeSelector';
import { TimeSeriesChart } from '@/components/reports';
import { Account, Category, DashboardFilters, ReportData } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  buildDistributionTemplateItems,
  categoryReportNodeToDistribution,
  categoryReportNodesToParentBreakdowns,
  categoryReportNodesToSubcategoryDistribution,
  merchantBreakdownToDistribution,
  genericToDistribution,
} from '@/lib/distributionHelpers';
import { Tag, CreditCard, DollarSign, ChevronDown, ChevronRight, CornerDownRight, ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react';
import { getCategoryIcon } from '@/lib/categoryIcons';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

type TrendMode = 'overall' | 'category' | 'income' | 'income-vs-outcome';
type CategoryReportNode = ReportData['categoryBreakdown'][number];
type CategoryTransaction = CategoryReportNode['transactions'][number];
type TimeGranularity = 'day' | 'month';

function getTypeIcon(type: string) {
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
}

function getBucketKey(rawDate: Date | string, granularity: TimeGranularity) {
  const date = new Date(rawDate);
  if (granularity === 'month') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function collectTransactionsFromNode(node: CategoryReportNode): CategoryTransaction[] {
  const transactions = [...node.transactions];
  for (const subcategory of node.subcategories) {
    transactions.push(...collectTransactionsFromNode(subcategory));
  }
  return transactions;
}

function bucketToMonthKey(bucket: string) {
  if (/^\d{4}-\d{2}$/.test(bucket)) return bucket;
  if (/^\d{4}-\d{2}-\d{2}$/.test(bucket)) return bucket.slice(0, 7);

  const parsedDate = new Date(bucket);
  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`;
}

function aggregateAmountSeries(series: ReportData['timeSeries'], granularity: TimeGranularity): ReportData['timeSeries'] {
  if (granularity === 'day') {
    return [...series].sort((a, b) => a.date.localeCompare(b.date));
  }

  const monthMap = new Map<string, number>();
  for (const point of series) {
    const monthKey = bucketToMonthKey(point.date);
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + point.amount);
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));
}

function aggregateIncomeOutcomeSeries(
  series: ReportData['incomeVsOutcomeSeries'],
  granularity: TimeGranularity
): ReportData['incomeVsOutcomeSeries'] {
  if (granularity === 'day') {
    return [...series].sort((a, b) => a.date.localeCompare(b.date));
  }

  const monthMap = new Map<string, { income: number; outcome: number }>();
  for (const point of series) {
    const monthKey = bucketToMonthKey(point.date);
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { income: 0, outcome: 0 });
    }
    const bucket = monthMap.get(monthKey)!;
    bucket.income += point.income;
    bucket.outcome += point.outcome;
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, totals]) => ({
      date,
      income: totals.income,
      outcome: totals.outcome,
    }));
}

function CategoryRow({
  node,
  level = 0,
  expandedIds,
  toggleExpanded,
  onEditTransactionCategory,
  editingDescriptionId,
  tempDescription,
  onStartDescriptionEdit,
  onTempDescriptionChange,
  onCommitDescriptionEdit,
  onCancelDescriptionEdit,
  formatAmount,
}: {
  node: any,
  level?: number,
  expandedIds: Set<string>,
  toggleExpanded: (id: string) => void,
  onEditTransactionCategory: (tx: any) => void,
  editingDescriptionId: string | null,
  tempDescription: string,
  onStartDescriptionEdit: (id: string, currentDescription: string) => void,
  onTempDescriptionChange: (value: string) => void,
  onCommitDescriptionEdit: (id: string, nextValue: string, currentDescription: string) => void,
  onCancelDescriptionEdit: () => void,
  formatAmount: (amount: number) => string,
}) {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.subcategories?.length > 0 || node.transactions?.length > 0;

  return (
    <React.Fragment>
      <tr
        className={`hover:bg-gray-50 transition-colors ${isExpanded && level === 0 ? 'bg-blue-50/30' : ''} ${hasChildren ? 'cursor-pointer' : ''}`}
        onClick={() => hasChildren && toggleExpanded(node.id)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 1.5}rem` }}>
            {level > 0 && <CornerDownRight className="w-3 h-3 text-gray-300 shrink-0" />}
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              )
            ) : (
              <div className="w-4 h-4 shrink-0" /> // Placeholder for alignment
            )}
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: node.color }}
            />
            <span className={`font-medium text-gray-900 truncate ${level > 0 ? 'text-sm' : ''}`}>{node.name}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right text-gray-500">{node.count}</td>
        <td className="px-4 py-3 text-right font-medium text-gray-900">
          {formatAmount(node.amount)}
        </td>
        <td className="px-4 py-3 text-right text-gray-500">
          {node.percentage.toFixed(1)}%
        </td>
      </tr>

      {isExpanded && node.subcategories?.map((sub: any) => (
        <CategoryRow
          key={sub.id}
          node={sub}
          level={level + 1}
          expandedIds={expandedIds}
          toggleExpanded={toggleExpanded}
          onEditTransactionCategory={onEditTransactionCategory}
          editingDescriptionId={editingDescriptionId}
          tempDescription={tempDescription}
          onStartDescriptionEdit={onStartDescriptionEdit}
          onTempDescriptionChange={onTempDescriptionChange}
          onCommitDescriptionEdit={onCommitDescriptionEdit}
          onCancelDescriptionEdit={onCancelDescriptionEdit}
          formatAmount={formatAmount}
        />
      ))}

      {isExpanded && (!node.subcategories || node.subcategories.length === 0) && node.transactions?.length > 0 && (
        <tr>
          <td colSpan={4} className="p-0 bg-gray-50/50 border-b border-gray-100">
            <div className="py-3 overflow-y-auto" style={{ paddingLeft: `${(level + 1) * 1.5 + 1.5}rem`, paddingRight: '1rem' }}>
              <table className="w-full text-sm">
                <tbody>
                  {node.transactions.map((tx: any) => (
                    <tr key={tx.id} className="border-b border-gray-100/50 last:border-0 hover:bg-white transition-colors">
                      <td className="py-2 text-gray-500 whitespace-nowrap w-24">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-2 text-gray-900 truncate max-w-[200px]">
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            {getTypeIcon(tx.type)}
                            {editingDescriptionId === tx.id ? (
                              <input
                                autoFocus
                                value={tempDescription}
                                onChange={(e) => onTempDescriptionChange(e.target.value)}
                                onBlur={(e) => onCommitDescriptionEdit(tx.id, e.target.value, tx.description)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    onCancelDescriptionEdit();
                                  }
                                }}
                                className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => onStartDescriptionEdit(tx.id, tx.description)}
                                className="truncate text-left hover:text-blue-600 transition-colors cursor-text"
                                title="Edit description"
                              >
                                {tx.description}
                              </button>
                            )}
                          </div>
                          {tx.category ? (
                            (() => {
                              const CategoryIcon = getCategoryIcon(tx.category.icon);
                              return (
                                <button
                                  type="button"
                                  onClick={() => onEditTransactionCategory(tx)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
                                  style={{
                                    backgroundColor: `${tx.category.color}20`,
                                    color: tx.category.color,
                                  }}
                                  title="Change category"
                                >
                                  <CategoryIcon className="w-3.5 h-3.5" />
                                  {tx.category.name}
                                </button>
                              );
                            })()
                          ) : (
                            <button
                              type="button"
                              onClick={() => onEditTransactionCategory(tx)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs shrink-0 bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
                              title="Set category"
                            >
                              <Tag className="w-3.5 h-3.5" />
                              Uncategorized
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2 text-right font-medium text-gray-900">
                        {formatAmount(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

export default function ReportsPage() {
  const { hideSensitiveValues } = useSensitiveValues();
  const [data, setData] = useState<ReportData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchantToCategorize, setMerchantToCategorize] = useState<ReportData['merchantBreakdown'][number] | null>(null);
  const [selectedMerchantCategory, setSelectedMerchantCategory] = useState('');
  const [isSavingMerchantCategory, setIsSavingMerchantCategory] = useState(false);
  const [transactionToCategorize, setTransactionToCategorize] = useState<{ id: string; description: string; type: 'INCOME' | 'EXPENSE' | 'TRANSFER'; category?: { id: string; name: string; color: string; icon?: string | null } | null } | null>(null);
  const [selectedTransactionCategory, setSelectedTransactionCategory] = useState('');
  const [isSavingTransactionCategory, setIsSavingTransactionCategory] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null);
  const [tempDescription, setTempDescription] = useState('');
  const [editingMerchantKey, setEditingMerchantKey] = useState<string | null>(null);
  const [tempMerchantName, setTempMerchantName] = useState('');
  const [trendMode, setTrendMode] = useState<TrendMode>('overall');
  const [trendCategoryId, setTrendCategoryId] = useState('');
  const [trendGranularity, setTrendGranularity] = useState<TimeGranularity>('month');
  const [isTrendCategoryOpen, setIsTrendCategoryOpen] = useState(false);
  const trendCategoryFilterRef = useRef<HTMLDivElement | null>(null);

  const formatAmount = useCallback(
    (amount: number) => formatCurrency(amount, { hideSensitiveValues }),
    [hideSensitiveValues]
  );

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCategories(newExpanded);
  };

  const [filters, setFilters] = useState<DashboardFilters>({});

  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom.toISOString());
      if (filters.dateTo) params.set('dateTo', filters.dateTo.toISOString());
      if (filters.accountIds?.length) params.set('accountIds', filters.accountIds.join(','));
      if (filters.categoryIds?.length) params.set('categoryIds', filters.categoryIds.join(','));
      if (filters.transactionType) params.set('type', filters.transactionType);
      if (filters.searchQuery) params.set('search', filters.searchQuery);
      if (filters.minAmount !== undefined) params.set('minAmount', String(filters.minAmount));
      if (filters.maxAmount !== undefined) params.set('maxAmount', String(filters.maxAmount));

      const [reportsRes, accountsRes, categoriesRes] = await Promise.all([
        fetch(`/api/reports?${params}`),
        fetch('/api/accounts'),
        fetch('/api/categories'),
      ]);

      const [reportsData, accountsData, categoriesData] = await Promise.all([
        reportsRes.json(),
        accountsRes.json(),
        categoriesRes.json(),
      ]);

      setData(reportsData);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error) {
      console.error('Failed to fetch reports data:', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { categoryTrendOptions, categoryTrendNodeMap } = useMemo(() => {
    const options: { id: string; name: string; color: string; label: string }[] = [];
    const nodeMap = new Map<string, CategoryReportNode>();

    if (!data) {
      return { categoryTrendOptions: options, categoryTrendNodeMap: nodeMap };
    }

    const visitNode = (node: CategoryReportNode, depth: number) => {
      nodeMap.set(node.id, node);
      const prefix = depth > 0 ? `${'-- '.repeat(depth)}` : '';
      options.push({
        id: node.id,
        name: node.name,
        color: node.color,
        label: `${prefix}${node.name}`,
      });

      for (const subcategory of node.subcategories) {
        visitNode(subcategory, depth + 1);
      }
    };

    for (const rootNode of data.categoryBreakdown) {
      visitNode(rootNode, 0);
    }

    return { categoryTrendOptions: options, categoryTrendNodeMap: nodeMap };
  }, [data]);

  useEffect(() => {
    if (trendMode !== 'category') return;

    if (categoryTrendOptions.length === 0) {
      if (trendCategoryId) setTrendCategoryId('');
      return;
    }

    const selectedStillExists = categoryTrendNodeMap.has(trendCategoryId);
    if (!trendCategoryId || !selectedStillExists) {
      setTrendCategoryId(categoryTrendOptions[0].id);
    }
  }, [trendMode, trendCategoryId, categoryTrendOptions, categoryTrendNodeMap]);

  const categoryTrendSeries = useMemo(() => {
    if (!data || !trendCategoryId) return [];
    const selectedNode = categoryTrendNodeMap.get(trendCategoryId);
    if (!selectedNode) return [];

    const bucketMap = new Map<string, number>();

    for (const transaction of collectTransactionsFromNode(selectedNode)) {
      const key = getBucketKey(transaction.date, trendGranularity);
      bucketMap.set(key, (bucketMap.get(key) || 0) + transaction.amount);
    }

    return Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount }));
  }, [data, trendCategoryId, categoryTrendNodeMap, trendGranularity]);

  const incomeTrendSeries = useMemo(
    () => aggregateAmountSeries(data?.incomeTimeSeries || [], trendGranularity),
    [data, trendGranularity]
  );

  const incomeVsOutcomeTrendSeries = useMemo(
    () => aggregateIncomeOutcomeSeries(data?.incomeVsOutcomeSeries || [], trendGranularity),
    [data, trendGranularity]
  );

  const selectedTrendCategory = useMemo(
    () => categoryTrendOptions.find((option) => option.id === trendCategoryId) || null,
    [categoryTrendOptions, trendCategoryId]
  );

  const trendSelectableCategories = useMemo(() => {
    if (categoryTrendOptions.length === 0) return [];
    const allowedIds = new Set(categoryTrendOptions.map((option) => option.id));
    return categories.filter((category) => allowedIds.has(category.id));
  }, [categories, categoryTrendOptions]);

  useEffect(() => {
    if (!isTrendCategoryOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!trendCategoryFilterRef.current) return;
      if (trendCategoryFilterRef.current.contains(event.target as Node)) return;
      setIsTrendCategoryOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isTrendCategoryOpen]);

  useEffect(() => {
    if (trendMode !== 'category') {
      setIsTrendCategoryOpen(false);
    }
  }, [trendMode]);

  const openMerchantCategorize = (merchant: ReportData['merchantBreakdown'][number]) => {
    setMerchantToCategorize(merchant);
    setSelectedMerchantCategory(merchant.primaryCategory?.id || '');
  };

  const closeMerchantCategorize = () => {
    setMerchantToCategorize(null);
    setSelectedMerchantCategory('');
  };

  const openTransactionCategorize = (tx: any) => {
    setTransactionToCategorize(tx);
    setSelectedTransactionCategory(tx.category?.id || '');
  };

  const closeTransactionCategorize = () => {
    setTransactionToCategorize(null);
    setSelectedTransactionCategory('');
  };

  const startDescriptionEdit = (id: string, currentDescription: string) => {
    setEditingDescriptionId(id);
    setTempDescription(currentDescription);
  };

  const cancelDescriptionEdit = () => {
    setEditingDescriptionId(null);
    setTempDescription('');
  };

  const handleDescriptionCommit = async (id: string, nextValue: string, currentDescription: string) => {
    const nextDescription = nextValue.trim();
    const previousDescription = currentDescription.trim();

    // Close immediately so first outside click feels responsive.
    setEditingDescriptionId(null);
    setTempDescription('');

    if (!nextDescription || nextDescription === previousDescription) {
      return;
    }

    try {
      await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, description: nextDescription }),
      });
      await fetchData({ silent: true });
    } catch (error) {
      console.error('Failed to update transaction description:', error);
    }
  };

  const handleMerchantCategorize = async () => {
    if (!merchantToCategorize) return;
    setIsSavingMerchantCategory(true);
    try {
      await fetch('/api/transactions/bulk-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: merchantToCategorize.transactionIds,
          categoryId: selectedMerchantCategory || null,
        }),
      });
      closeMerchantCategorize();
      await fetchData({ silent: true });
    } catch (error) {
      console.error('Failed to categorize merchant transactions:', error);
    } finally {
      setIsSavingMerchantCategory(false);
    }
  };

  const handleTransactionCategorize = async () => {
    if (!transactionToCategorize) return;
    setIsSavingTransactionCategory(true);
    try {
      await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transactionToCategorize.id,
          categoryId: selectedTransactionCategory || null,
        }),
      });
      closeTransactionCategorize();
      await fetchData({ silent: true });
    } catch (error) {
      console.error('Failed to categorize transaction:', error);
    } finally {
      setIsSavingTransactionCategory(false);
    }
  };

  const startMerchantNameEdit = (merchantKey: string, merchantName: string) => {
    setEditingMerchantKey(merchantKey);
    setTempMerchantName(merchantName);
  };

  const cancelMerchantNameEdit = () => {
    setEditingMerchantKey(null);
    setTempMerchantName('');
  };

  const handleMerchantNameCommit = async (
    merchant: ReportData['merchantBreakdown'][number],
    nextValue: string
  ) => {
    const nextName = nextValue.trim();
    const previousName = merchant.name.trim();

    setEditingMerchantKey(null);
    setTempMerchantName('');

    if (!nextName || nextName === previousName || merchant.transactionIds.length === 0) {
      return;
    }

    try {
      await Promise.all(
        merchant.transactionIds.map((transactionId) =>
          fetch('/api/transactions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: transactionId,
              description: nextName,
            }),
          })
        )
      );
      await fetchData({ silent: true });
    } catch (error) {
      console.error('Failed to update merchant name:', error);
    }
  };

  const isIncome = filters.transactionType === 'INCOME';
  const isTransfer = filters.transactionType === 'TRANSFER';
  const typeLabel = isIncome ? 'Income' : isTransfer ? 'Transfer' : 'Expense';
  const summaryToneClass = isIncome
    ? 'bg-green-100 text-green-600'
    : isTransfer
      ? 'bg-blue-100 text-blue-600'
      : 'bg-red-100 text-red-600';

  const trendModeOptions: { value: TrendMode; label: string }[] = [
    { value: 'overall', label: `${typeLabel} Over Time` },
    { value: 'category', label: 'Category Trend' },
    { value: 'income', label: 'Income Over Time' },
    { value: 'income-vs-outcome', label: 'Income vs Outcome' },
  ];
  const trendGranularityOptions: { value: TimeGranularity; label: string }[] = [
    { value: 'day', label: 'Daily' },
    { value: 'month', label: 'Monthly' },
  ];

  const trendCardConfig = useMemo(() => {
    const defaultConfig = {
      title: `${typeLabel} Over Time`,
      subtitle: undefined as string | undefined,
      chartMode: 'single' as const,
      chartData: data?.timeSeries || [],
      singleSeriesLabel: typeLabel,
      singleSeriesColor: '#3B82F6',
    };

    if (!data) return defaultConfig;

    if (trendMode === 'category') {
      return {
        title: 'Category Trend',
        subtitle: selectedTrendCategory
          ? `${selectedTrendCategory.name} by ${trendGranularity === 'month' ? 'month' : 'day'}`
          : 'Select a category to view trend',
        chartMode: 'single' as const,
        chartData: categoryTrendSeries,
        singleSeriesLabel: selectedTrendCategory?.name || 'Category',
        singleSeriesColor: selectedTrendCategory?.color || '#3B82F6',
      };
    }

    if (trendMode === 'income') {
      return {
        title: 'Income Over Time',
        subtitle: `How your income changed by ${trendGranularity === 'month' ? 'month' : 'day'}`,
        chartMode: 'single' as const,
        chartData: incomeTrendSeries,
        singleSeriesLabel: 'Income',
        singleSeriesColor: '#16A34A',
      };
    }

    if (trendMode === 'income-vs-outcome') {
      return {
        title: 'Income vs Outcome',
        subtitle: `Compare inflows and outflows by ${trendGranularity === 'month' ? 'month' : 'day'}`,
        chartMode: 'comparison' as const,
        chartData: incomeVsOutcomeTrendSeries,
        singleSeriesLabel: 'Amount',
        singleSeriesColor: '#3B82F6',
      };
    }

    return defaultConfig;
  }, [data, trendMode, typeLabel, categoryTrendSeries, selectedTrendCategory, trendGranularity, incomeTrendSeries, incomeVsOutcomeTrendSeries]);

  const hasTrendData = useMemo(() => {
    if (trendCardConfig.chartMode === 'comparison') {
      return (trendCardConfig.chartData as ReportData['incomeVsOutcomeSeries']).some(
        (point) => point.income > 0 || point.outcome > 0
      );
    }

    return (trendCardConfig.chartData as ReportData['timeSeries']).some((point) => point.amount > 0);
  }, [trendCardConfig]);

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[calc(100dvh-10rem)] items-center justify-center">
        <Loader size={80} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-500 mt-1">Deep dive into your spending habits and trends</p>
      </div>

      <DashboardFiltersPanel
        accounts={accounts}
        categories={categories}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {data && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${summaryToneClass}`}>
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total {typeLabel}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatAmount(data.summary.totalAmount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                    <Tag className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Transactions</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {data.summary.transactionCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-purple-100 text-purple-600">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Average Transaction</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatAmount(data.summary.averageAmount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader
                title={trendCardConfig.title}
                subtitle={trendCardConfig.subtitle}
                action={
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <select
                      value={trendMode}
                      onChange={(e) => setTrendMode(e.target.value as TrendMode)}
                      className="text-sm bg-white border border-gray-200 text-gray-700 py-1 px-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {trendModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {trendMode !== 'overall' && (
                      <select
                        value={trendGranularity}
                        onChange={(e) => setTrendGranularity(e.target.value as TimeGranularity)}
                        className="text-sm bg-white border border-gray-200 text-gray-700 py-1 px-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {trendGranularityOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {trendMode === 'category' && (
                      <div className="relative min-w-[220px]" ref={trendCategoryFilterRef}>
                        <button
                          type="button"
                          onClick={() => setIsTrendCategoryOpen((prev) => !prev)}
                          className="w-full h-9 px-3 border border-gray-200 rounded-lg bg-white text-sm text-left flex items-center justify-between gap-2 hover:border-gray-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={trendSelectableCategories.length === 0}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            {selectedTrendCategory ? (
                              <>
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: selectedTrendCategory.color }}
                                />
                                <span className="truncate">{selectedTrendCategory.name}</span>
                              </>
                            ) : (
                              <span className="truncate text-gray-500">Select category</span>
                            )}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isTrendCategoryOpen ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {isTrendCategoryOpen && (
                          <div className="absolute right-0 z-30 mt-2 w-[24rem] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg p-2">
                            <CategoryTreeSelector
                              categories={trendSelectableCategories}
                              value={trendCategoryId}
                              onChange={(categoryId) => {
                                setTrendCategoryId(categoryId);
                                setIsTrendCategoryOpen(false);
                              }}
                              transactionType={filters.transactionType || null}
                              includeUncategorized={false}
                              allowParentSelection
                              maxHeightClassName="max-h-72"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                }
              />
              <CardContent>
                {hasTrendData ? (
                  <TimeSeriesChart
                    mode={trendCardConfig.chartMode}
                    data={trendCardConfig.chartData}
                    singleSeriesLabel={trendCardConfig.singleSeriesLabel}
                    singleSeriesColor={trendCardConfig.singleSeriesColor}
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No data available for this period
                  </div>
                )}
              </CardContent>
            </Card>

            <DistributionCarousel
              items={buildDistributionTemplateItems({
                expenseByCategory: categoryReportNodeToDistribution(data.categoryBreakdown),
                expenseBySubcategory: categoryReportNodesToSubcategoryDistribution(data.categoryBreakdown),
                parentBreakdowns: categoryReportNodesToParentBreakdowns(data.categoryBreakdown),
                incomeByCategory: [],
                topMerchants: merchantBreakdownToDistribution(data.merchantBreakdown),
                expenseByAccount: genericToDistribution(data.accountDistribution),
                recurringVsOneTime: genericToDistribution(data.recurringVsOneTime),
                expenseByWeekday: genericToDistribution(data.weekdayPattern),
              })}
            />
          </div>

          {/* Breakdown Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <Card>
              <CardHeader title="Category Breakdown" subtitle="Detailed spending by category" />
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 bg-gray-50 sticky top-0 border-y border-gray-100">
                    <tr>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium text-right">Count</th>
                      <th className="px-4 py-3 font-medium text-right">Amount</th>
                      <th className="px-4 py-3 font-medium text-right">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.categoryBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          No categories found
                        </td>
                      </tr>
                    ) : (
                      data.categoryBreakdown.map((cat) => (
                        <CategoryRow
                          key={cat.id}
                          node={cat}
                          expandedIds={expandedCategories}
                          toggleExpanded={toggleExpanded}
                          onEditTransactionCategory={openTransactionCategorize}
                          editingDescriptionId={editingDescriptionId}
                          tempDescription={tempDescription}
                          onStartDescriptionEdit={startDescriptionEdit}
                          onTempDescriptionChange={setTempDescription}
                          onCommitDescriptionEdit={handleDescriptionCommit}
                          onCancelDescriptionEdit={cancelDescriptionEdit}
                          formatAmount={formatAmount}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Merchant Breakdown */}
            <Card>
              <CardHeader title="Top Merchants / Payees" subtitle="Based on transaction description" />
              <div className="max-h-[400px] overflow-y-auto overflow-x-hidden">
                <table className="w-full table-fixed text-sm text-left">
                  <thead className="text-xs text-gray-500 bg-gray-50 sticky top-0 border-y border-gray-100">
                    <tr>
                      <th className="px-4 py-3 font-medium">Merchant</th>
                      <th className="px-4 py-3 font-medium text-right w-20">Count</th>
                      <th className="px-4 py-3 font-medium text-right w-28">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.merchantBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                          No merchants found
                        </td>
                      </tr>
                    ) : (
                      data.merchantBreakdown.map((merchant, i) => {
                        const CategoryIcon = getCategoryIcon(merchant.primaryCategory?.icon);
                        const merchantKey = merchant.transactionIds[0] || merchant.name || `merchant-${i}`;

                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 min-w-0 w-full">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {merchant.transactionType ? getTypeIcon(merchant.transactionType) : null}
                                  {editingMerchantKey === merchantKey ? (
                                    <input
                                      autoFocus
                                      value={tempMerchantName}
                                      onChange={(e) => setTempMerchantName(e.target.value)}
                                      onBlur={(e) => handleMerchantNameCommit(merchant, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          e.currentTarget.blur();
                                        } else if (e.key === 'Escape') {
                                          e.preventDefault();
                                          cancelMerchantNameEdit();
                                        }
                                      }}
                                      className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => startMerchantNameEdit(merchantKey, merchant.name || 'UNKNOWN')}
                                      className="font-medium text-gray-900 truncate min-w-0 text-left hover:text-blue-600 transition-colors cursor-text"
                                      title="Edit merchant name"
                                    >
                                      {merchant.name || 'UNKNOWN'}
                                    </button>
                                  )}
                                </div>
                                {merchant.primaryCategory ? (
                                  <button
                                    type="button"
                                    onClick={() => openMerchantCategorize(merchant)}
                                    className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs shrink-0 hover:opacity-80 cursor-pointer transition-opacity"
                                    style={{
                                      backgroundColor: `${merchant.primaryCategory.color}20`,
                                      color: merchant.primaryCategory.color,
                                    }}
                                    title="Change category"
                                  >
                                    <CategoryIcon className="w-3.5 h-3.5" />
                                    {merchant.primaryCategory.name}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openMerchantCategorize(merchant)}
                                    className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs shrink-0 bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer transition-colors"
                                    title="Set category"
                                  >
                                    <Tag className="w-3.5 h-3.5" />
                                    Uncategorized
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">{merchant.count}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                              {formatAmount(merchant.amount)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Largest Transactions */}
          <Card>
            <CardHeader title="Largest Transactions" subtitle="Top 10 highest value transactions" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 bg-gray-50 border-y border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Account</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.largestTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    data.largestTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2 min-w-0">
                            {getTypeIcon(tx.type)}
                            {editingDescriptionId === tx.id ? (
                              <input
                                autoFocus
                                value={tempDescription}
                                onChange={(e) => setTempDescription(e.target.value)}
                                onBlur={(e) => handleDescriptionCommit(tx.id, e.target.value, tx.description)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelDescriptionEdit();
                                  }
                                }}
                                className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => startDescriptionEdit(tx.id, tx.description)}
                                className="truncate text-left hover:text-blue-600 transition-colors cursor-text"
                                title="Edit description"
                              >
                                {tx.description}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {tx.category ? (
                            (() => {
                              const CategoryIcon = getCategoryIcon(tx.category.icon);
                              return (
                                <button
                                  type="button"
                                  onClick={() => openTransactionCategorize(tx)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs hover:opacity-80 transition-opacity cursor-pointer"
                                  style={{
                                    backgroundColor: `${tx.category.color}20`,
                                    color: tx.category.color,
                                  }}
                                  title="Change category"
                                >
                                  <CategoryIcon className="w-3.5 h-3.5" />
                                  {tx.category.name}
                                </button>
                              );
                            })()
                          ) : (
                            <button
                              type="button"
                              onClick={() => openTransactionCategorize(tx)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
                              title="Set category"
                            >
                              <Tag className="w-3.5 h-3.5" />
                              Uncategorized
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {tx.account?.name}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {formatAmount(tx.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Modal
        isOpen={!!merchantToCategorize}
        onClose={closeMerchantCategorize}
        title="Change Merchant Category"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 line-clamp-2">
            {merchantToCategorize?.name}
          </p>
          <CategoryTreeSelector
            categories={categories}
            value={selectedMerchantCategory}
            onChange={setSelectedMerchantCategory}
            transactionType={merchantToCategorize?.transactionType || null}
            allowParentSelection={false}
            includeUncategorized
            maxHeightClassName="max-h-72"
          />
          <p className="text-xs text-gray-500">
            This will update {merchantToCategorize?.transactionIds.length || 0} transaction(s) from this merchant.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeMerchantCategorize} disabled={isSavingMerchantCategory}>
              Cancel
            </Button>
            <Button onClick={handleMerchantCategorize} disabled={isSavingMerchantCategory}>
              {isSavingMerchantCategory ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!transactionToCategorize}
        onClose={closeTransactionCategorize}
        title="Change Transaction Category"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 line-clamp-2">
            {transactionToCategorize?.description}
          </p>
          <CategoryTreeSelector
            categories={categories}
            value={selectedTransactionCategory}
            onChange={setSelectedTransactionCategory}
            transactionType={transactionToCategorize?.type || null}
            allowParentSelection={false}
            includeUncategorized
            maxHeightClassName="max-h-72"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeTransactionCategorize} disabled={isSavingTransactionCategory}>
              Cancel
            </Button>
            <Button onClick={handleTransactionCategorize} disabled={isSavingTransactionCategory}>
              {isSavingTransactionCategory ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
