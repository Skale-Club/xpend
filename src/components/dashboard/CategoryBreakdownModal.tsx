'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Tag } from 'lucide-react';
import { Modal, Loader, Button } from '@/components/ui';
import { CategoryTreeSelector } from '@/components/categories/CategoryTreeSelector';
import { Category, CategoryBreakdownData, DashboardFilters } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import { getCategoryIcon } from '@/lib/categoryIcons';

type BreakdownTransaction = CategoryBreakdownData['transactions'][number];

interface CategoryBreakdownModalProps {
  /** Root category to drill into. `null` keeps the modal closed. */
  parentCategoryId: string | null;
  /** Active dashboard/report filters — forwarded to the breakdown query. */
  filters: DashboardFilters;
  categories: Category[];
  onClose: () => void;
  /** Called after a transaction is recategorized or renamed, so the host can refresh its own data. */
  onMutated?: () => void;
}

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

function buildBreakdownParams(parentCategoryId: string, filters: DashboardFilters) {
  const params = new URLSearchParams();
  params.set('parentCategoryId', parentCategoryId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom.toISOString());
  if (filters.dateTo) params.set('dateTo', filters.dateTo.toISOString());
  if (filters.accountIds?.length) params.set('accountIds', filters.accountIds.join(','));
  if (filters.categoryIds?.length) params.set('categoryIds', filters.categoryIds.join(','));
  if (filters.minAmount) params.set('minAmount', filters.minAmount.toString());
  if (filters.maxAmount) params.set('maxAmount', filters.maxAmount.toString());
  if (filters.searchQuery) params.set('search', filters.searchQuery);
  return params;
}

export function CategoryBreakdownModal({
  parentCategoryId,
  filters,
  categories,
  onClose,
  onMutated,
}: CategoryBreakdownModalProps) {
  const { hideSensitiveValues } = useSensitiveValues();

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<CategoryBreakdownData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null);
  const [tempDescription, setTempDescription] = useState('');

  const [transactionToCategorize, setTransactionToCategorize] = useState<BreakdownTransaction | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchBreakdown = useCallback(async () => {
    if (!parentCategoryId) return;
    setIsLoading(true);
    setData(null);
    setError(null);
    try {
      const params = buildBreakdownParams(parentCategoryId, filters);
      const response = await fetch(`/api/dashboard/category-breakdown?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load breakdown');
      setData(await response.json());
    } catch (err) {
      console.error('Failed to fetch category breakdown:', err);
      setError('Failed to load category breakdown');
    } finally {
      setIsLoading(false);
    }
  }, [parentCategoryId, filters]);

  useEffect(() => {
    if (parentCategoryId) {
      fetchBreakdown();
    } else {
      setData(null);
      setError(null);
      setEditingDescriptionId(null);
      setTempDescription('');
    }
  }, [parentCategoryId, fetchBreakdown]);

  const cancelDescriptionEdit = () => {
    setEditingDescriptionId(null);
    setTempDescription('');
  };

  const startDescriptionEdit = (id: string, currentDescription: string) => {
    setEditingDescriptionId(id);
    setTempDescription(currentDescription);
  };

  const handleDescriptionCommit = async (id: string, nextValue: string, currentDescription: string) => {
    const nextDescription = nextValue.trim();
    setEditingDescriptionId(null);
    setTempDescription('');
    if (!nextDescription || nextDescription === currentDescription) return;

    try {
      await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, description: nextDescription }),
      });
      setData((previous) =>
        previous
          ? {
              ...previous,
              transactions: previous.transactions.map((t) =>
                t.id === id ? { ...t, description: nextDescription } : t
              ),
            }
          : previous
      );
      onMutated?.();
    } catch (err) {
      console.error('Failed to update breakdown transaction description:', err);
    }
  };

  const openTransactionCategorize = (transaction: BreakdownTransaction) => {
    setTransactionToCategorize(transaction);
    setSelectedCategory(transaction.category?.id || '');
  };

  const closeTransactionCategorize = () => {
    setTransactionToCategorize(null);
    setSelectedCategory('');
  };

  const handleTransactionCategorize = async () => {
    if (!transactionToCategorize) return;
    setIsSaving(true);
    try {
      await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transactionToCategorize.id,
          categoryId: selectedCategory || null,
        }),
      });
      closeTransactionCategorize();
      await fetchBreakdown();
      onMutated?.();
    } catch (err) {
      console.error('Failed to categorize breakdown transaction:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={!!parentCategoryId}
        onClose={() => {
          cancelDescriptionEdit();
          onClose();
        }}
        title={data ? `${data.category.name} Breakdown` : 'Category Breakdown'}
        size="xl"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader size={56} />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-destructive">{error}</div>
        ) : data ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-muted px-3 py-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</div>
                <div className="text-base font-bold text-foreground">
                  {formatCurrency(data.category.total, { hideSensitiveValues })}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted px-3 py-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transactions</div>
                <div className="text-base font-bold text-foreground">{data.totalTransactions}</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Subcategories</h3>
              <div className="space-y-2">
                {data.subcategories.length === 0 ? (
                  <div className="rounded-lg border border-border px-3 py-4 text-sm text-muted-foreground">
                    No subcategories found.
                  </div>
                ) : (
                  data.subcategories.map((subcategory) => (
                    <div key={subcategory.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: subcategory.color }} />
                        <span className="text-sm text-foreground truncate">{subcategory.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(subcategory.total, { hideSensitiveValues })}
                        </span>
                        <span className="text-xs text-muted-foreground min-w-[3rem] text-right">
                          {subcategory.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Related Transactions</h3>
              <div className="max-h-[320px] overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground bg-muted sticky top-0 border-b border-border">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium">Subcategory</th>
                      <th className="px-3 py-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                          No transactions found for this category.
                        </td>
                      </tr>
                    ) : (
                      data.transactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-muted">
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(transaction.date)}</td>
                          <td className="px-3 py-2 text-foreground max-w-[220px]">
                            <div className="flex items-center gap-2 min-w-0">
                              {getTypeIcon(transaction.type)}
                              {editingDescriptionId === transaction.id ? (
                                <input
                                  autoFocus
                                  value={tempDescription}
                                  onChange={(event) => setTempDescription(event.target.value)}
                                  onBlur={(event) =>
                                    handleDescriptionCommit(transaction.id, event.target.value, transaction.description)
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      event.currentTarget.blur();
                                    } else if (event.key === 'Escape') {
                                      event.preventDefault();
                                      cancelDescriptionEdit();
                                    }
                                  }}
                                  className="w-full bg-card border border-primary/50 rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startDescriptionEdit(transaction.id, transaction.description)}
                                  className="truncate text-left hover:text-primary transition-colors cursor-text"
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
                                    onClick={() => openTransactionCategorize(transaction)}
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
                                onClick={() => openTransactionCategorize(transaction)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground"
                                title="Set category"
                              >
                                <Tag className="w-3.5 h-3.5" />
                                {transaction.subcategoryName}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-foreground whitespace-nowrap">
                            {formatCurrency(transaction.amount, { hideSensitiveValues })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {data.truncated && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing the 100 most recent transactions for this category.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Select a category to view details.
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!transactionToCategorize}
        onClose={closeTransactionCategorize}
        title="Change Transaction Category"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {transactionToCategorize?.description}
          </p>
          <CategoryTreeSelector
            categories={categories}
            value={selectedCategory}
            onChange={setSelectedCategory}
            transactionType={transactionToCategorize?.type || null}
            allowParentSelection={false}
            includeUncategorized
            maxHeightClassName="max-h-72"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeTransactionCategorize} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleTransactionCategorize} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
