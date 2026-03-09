'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, ArrowRight, Tag, CheckSquare, Square, X, TagIcon, ChevronRight, ChevronDown, Search, Plus, Trash2, Download } from 'lucide-react';
import { Card, CardContent, Modal, Button, useToast } from '@/components/ui';
import { Transaction, Category, TransactionType } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getCategoryIcon } from '@/lib/categoryIcons';
import { CategoryTreeSelector } from '@/components/categories/CategoryTreeSelector';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import { exportTransactions } from '@/lib/export';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  onCategorize: (transactionId: string, categoryId: string | null) => Promise<void> | void;
  onDescriptionUpdate?: (transactionId: string, description: string) => Promise<void> | void;
  onCategorizeByKeyword?: (
    keyword: string,
    categoryId: string | null,
    transactionId: string
  ) => Promise<void> | void;
  onCategoryCreated?: () => Promise<void> | void;
  onBulkCategorize?: (transactionIds: string[], categoryId: string | null) => Promise<void> | void;
  onBulkDelete?: (transactionIds: string[]) => Promise<void> | void;
}

interface CategoryNode extends Category {
  children: CategoryNode[];
}

function collectExpandableCategoryIds(nodes: CategoryNode[], result: Set<string> = new Set()) {
  for (const node of nodes) {
    if (node.children.length > 0) {
      result.add(node.id);
      collectExpandableCategoryIds(node.children, result);
    }
  }
  return result;
}

function filterCategoryTree(nodes: CategoryNode[], query: string): CategoryNode[] {
  return nodes
    .map((node) => {
      const filteredChildren = filterCategoryTree(node.children, query);
      const selfMatches = node.name.toLowerCase().includes(query);

      if (selfMatches || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }

      return null;
    })
    .filter((node): node is CategoryNode => node !== null);
}

const DESCRIPTION_STOP_WORDS = new Set([
  'purchase', 'payment', 'mobile', 'transfer', 'debit', 'credit', 'card', 'online',
  'store', 'market', 'visa', 'mastercard', 'pos', 'ach', 'withdrawal', 'deposit',
  'transaction', 'check', 'bill', 'subscription', 'nh', 'ma', 'inc', 'llc',
]);

function suggestKeyword(description: string): string {
  const words = description
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && /[a-z]/.test(word) && !DESCRIPTION_STOP_WORDS.has(word));

  return words[0] || '';
}

function classifyRootCategory(name: string): 'income' | 'expense' | 'transfer' {
  const normalized = name.toLowerCase();
  if (normalized.includes('income') || normalized.includes('receita') || normalized.includes('entrada')) {
    return 'income';
  }
  if (normalized.includes('transfer')) {
    return 'transfer';
  }
  return 'expense';
}

export function TransactionList({
  transactions,
  categories,
  onCategorize,
  onDescriptionUpdate,
  onCategorizeByKeyword,
  onCategoryCreated,
  onBulkCategorize,
  onBulkDelete
}: TransactionListProps) {
  const { hideSensitiveValues } = useSensitiveValues();
  const toast = useToast();
  const [categorizeModal, setCategorizeModal] = useState<string | null>(null);
  const [categorizeTargetTransaction, setCategorizeTargetTransaction] = useState<Transaction | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [bulkCategorizeModal, setBulkCategorizeModal] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [isSavingBulkCategorization, setIsSavingBulkCategorization] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());
  const [applyToSimilar, setApplyToSimilar] = useState(false);
  const [similarKeyword, setSimilarKeyword] = useState('');
  const [isSavingCategorization, setIsSavingCategorization] = useState(false);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryParentId, setNewCategoryParentId] = useState('');
  const [createCategoryError, setCreateCategoryError] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Description editing state
  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null);
  const [tempDescription, setTempDescription] = useState('');

  const categoryTree = useMemo(() => {
    const categoryMap = new Map<string, CategoryNode>();
    const rootCategories: CategoryNode[] = [];

    for (const category of categories) {
      categoryMap.set(category.id, { ...category, children: [] });
    }

    for (const category of categories) {
      const node = categoryMap.get(category.id);
      if (!node) continue;

      if (category.parentId && categoryMap.has(category.parentId)) {
        const parent = categoryMap.get(category.parentId);
        parent?.children.push(node);
      } else {
        rootCategories.push(node);
      }
    }

    const applyInheritedColors = (nodes: CategoryNode[], parentColor?: string) => {
      for (const node of nodes) {
        if (parentColor) {
          node.color = parentColor;
        }

        if (node.children.length > 0) {
          applyInheritedColors(node.children, node.color);
        }
      }
    };
    applyInheritedColors(rootCategories);

    const sortTree = (nodes: CategoryNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      for (const node of nodes) {
        if (node.children.length > 0) {
          sortTree(node.children);
        }
      }
    };

    sortTree(rootCategories);
    return rootCategories;
  }, [categories]);

  const effectiveCategoryColors = useMemo(() => {
    const colorMap = new Map<string, string>();

    const walk = (nodes: CategoryNode[]) => {
      for (const node of nodes) {
        colorMap.set(node.id, node.color);
        if (node.children.length > 0) {
          walk(node.children);
        }
      }
    };

    walk(categoryTree);
    return colorMap;
  }, [categoryTree]);

  const effectiveCategoryIcons = useMemo(() => {
    const iconMap = new Map<string, string | null | undefined>();

    const walk = (nodes: CategoryNode[]) => {
      for (const node of nodes) {
        iconMap.set(node.id, node.icon);
        if (node.children.length > 0) {
          walk(node.children);
        }
      }
    };

    walk(categoryTree);
    return iconMap;
  }, [categoryTree]);

  const normalizedCategorySearch = categorySearch.trim().toLowerCase();

  const transactionTypeForModal = categorizeTargetTransaction?.type || null;

  const allowedRootCategoryTree = useMemo(() => {
    if (!transactionTypeForModal) return categoryTree;

    const filteredRoots = categoryTree.filter((rootCategory) => {
      const scope = classifyRootCategory(rootCategory.name);
      if (transactionTypeForModal === 'INCOME') return scope === 'income';
      if (transactionTypeForModal === 'TRANSFER') return scope === 'transfer';
      return scope === 'expense';
    });

    // Fallback: if no compatible categories are found, keep all categories visible.
    return filteredRoots.length > 0 ? filteredRoots : categoryTree;
  }, [categoryTree, transactionTypeForModal]);

  const filteredCategoryTree = useMemo(() => {
    if (!normalizedCategorySearch) return allowedRootCategoryTree;
    return filterCategoryTree(allowedRootCategoryTree, normalizedCategorySearch);
  }, [allowedRootCategoryTree, normalizedCategorySearch]);

  const autoExpandedFilteredIds = useMemo(
    () => collectExpandableCategoryIds(filteredCategoryTree),
    [filteredCategoryTree]
  );

  const showUncategorizedOption =
    normalizedCategorySearch === '' || 'uncategorized'.includes(normalizedCategorySearch);

  const parentCategoryOptions = useMemo(() => {
    // Only allow selecting root categories as parent in quick-create flow.
    return allowedRootCategoryTree.map((category) => ({
      id: category.id,
      label: category.name,
      color: category.color,
      icon: category.icon,
    }));
  }, [allowedRootCategoryTree]);

  const bulkTransactionType = useMemo<TransactionType | null>(() => {
    const selected = transactions.filter((transaction) => selectedTransactions.has(transaction.id));
    if (selected.length === 0) return null;

    const types = new Set(selected.map((transaction) => transaction.type));
    return types.size === 1 ? selected[0].type : null;
  }, [transactions, selectedTransactions]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'INCOME':
        return <ArrowUpRight className="w-4 h-4 text-green-500" />;
      case 'EXPENSE':
        return <ArrowDownRight className="w-4 h-4 text-red-500" />;
      case 'TRANSFER':
        return <ArrowRight className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const closeCategorizeModal = () => {
    setCategorizeModal(null);
    setCategorizeTargetTransaction(null);
    setCategorySearch('');
    setApplyToSimilar(false);
    setSimilarKeyword('');
    setIsCreateCategoryOpen(false);
    setNewCategoryName('');
    setNewCategoryParentId('');
    setCreateCategoryError('');
  };

  const handleDescriptionCommit = (id: string, nextValue: string) => {
    const nextDescription = nextValue.trim();
    const currentDescription = transactions.find((t) => t.id === id)?.description.trim() || '';

    // Close edit mode immediately so the first outside click always feels responsive.
    setEditingDescriptionId(null);
    setTempDescription('');

    if (!onDescriptionUpdate || !nextDescription || nextDescription === currentDescription) {
      return;
    }

    void onDescriptionUpdate(id, nextDescription);
  };

  const handleDescriptionCancel = () => {
    setEditingDescriptionId(null);
    setTempDescription('');
  };

  const handleCategorize = async () => {
    if (categorizeModal) {
      const categoryId = selectedCategory || null;
      setIsSavingCategorization(true);
      try {
        if (applyToSimilar && similarKeyword.trim() && onCategorizeByKeyword) {
          await onCategorizeByKeyword(similarKeyword.trim(), categoryId, categorizeModal);
        } else {
          await onCategorize(categorizeModal, categoryId);
        }
        closeCategorizeModal();
        setSelectedCategory('');
      } finally {
        setIsSavingCategorization(false);
      }
    }
  };

  const openCategorizeModal = (transaction: Transaction) => {
    setCategorizeModal(transaction.id);
    setCategorizeTargetTransaction(transaction);
    setSelectedCategory(transaction.categoryId || '');
    setCategorySearch('');
    // Open with collapsed tree; user expands only what is needed.
    setExpandedCategoryIds(new Set());
    setApplyToSimilar(false);
    setSimilarKeyword(suggestKeyword(transaction.description));
    setIsCreateCategoryOpen(false);
    setNewCategoryName('');
    setNewCategoryParentId('');
    setCreateCategoryError('');
  };

  const openCreateCategory = () => {
    setIsCreateCategoryOpen(true);
    setCreateCategoryError('');
    setNewCategoryName(categorySearch.trim());
    setNewCategoryParentId('');
  };

  const closeCreateCategory = () => {
    setIsCreateCategoryOpen(false);
    setNewCategoryName('');
    setNewCategoryParentId('');
    setCreateCategoryError('');
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setCreateCategoryError('Category name is required.');
      return;
    }

    setIsCreatingCategory(true);
    setCreateCategoryError('');
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          parentId: newCategoryParentId || null,
          color: '#6B7280',
          icon: 'Tag',
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create category');
      }

      if (onCategoryCreated) {
        await onCategoryCreated();
      }

      if (newCategoryParentId) {
        setExpandedCategoryIds((previous) => new Set(previous).add(newCategoryParentId));
      }

      setSelectedCategory(result.id);
      setCategorySearch('');
      closeCreateCategory();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create category';
      setCreateCategoryError(message);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedTransactions.size === transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(transactions.map(t => t.id)));
    }
  };

  const toggleSelect = (transactionId: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedTransactions(newSelected);
  };

  const handleBulkCategorize = async () => {
    if (!onBulkCategorize || selectedTransactions.size === 0) return;

    setIsSavingBulkCategorization(true);
    try {
      await onBulkCategorize(Array.from(selectedTransactions), bulkCategory || null);
      toast.success(`Categorized ${selectedTransactions.size} transactions`);
      setSelectedTransactions(new Set());
      setBulkCategorizeModal(false);
      setBulkCategory('');
    } catch {
      toast.error('Failed to categorize transactions', { showRetry: true, onRetry: handleBulkCategorize });
    } finally {
      setIsSavingBulkCategorization(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!onBulkDelete || selectedTransactions.size === 0) return;

    try {
      await onBulkDelete(Array.from(selectedTransactions));
      toast.success(`Deleted ${selectedTransactions.size} transactions`);
      setSelectedTransactions(new Set());
    } catch {
      toast.error('Failed to delete transactions', { showRetry: true, onRetry: handleBulkDelete });
    }
  };

  const handleBulkExport = (format: 'csv' | 'json') => {
    const selectedTx = transactions.filter((t) => selectedTransactions.has(t.id));
    exportTransactions(selectedTx, {
      format,
      filename: `selected-transactions-${new Date().toISOString().split('T')[0]}`
    });
    toast.success(`Exported ${selectedTx.length} transactions as ${format.toUpperCase()}`);
  };

  const openBulkCategorizeModal = () => {
    setBulkCategory('');
    setBulkCategorizeModal(true);
  };

  const clearSelection = () => {
    setSelectedTransactions(new Set());
  };

  const renderCategoryOption = (category: CategoryNode, level: number = 0) => {
    const isSelected = selectedCategory === category.id;
    const hasChildren = category.children.length > 0;
    const isExpanded = normalizedCategorySearch
      ? autoExpandedFilteredIds.has(category.id)
      : expandedCategoryIds.has(category.id);
    const CategoryIcon = getCategoryIcon(category.icon);

    return (
      <div key={category.id}>
        <div
          className={`w-full py-2.5 pr-3 flex items-center gap-3 transition-colors ${isSelected ? 'bg-green-50 hover:bg-green-50' : 'hover:bg-gray-50'
            }`}
          style={{ paddingLeft: `${12 + level * 20}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              disabled={!!normalizedCategorySearch}
              onClick={() => {
                setExpandedCategoryIds((previous) => {
                  const next = new Set(previous);
                  if (next.has(category.id)) {
                    next.delete(category.id);
                  } else {
                    next.add(category.id);
                  }
                  return next;
                });
              }}
              className={`p-0.5 rounded shrink-0 ${normalizedCategorySearch ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-gray-200'}`}
              title={isExpanded ? 'Collapse category' : 'Expand category'}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
          ) : (
            <span className="w-5 h-5 shrink-0" />
          )}
          {hasChildren ? (
            <div className="flex-1 min-w-0 flex items-center gap-3 text-left select-none">
              {isSelected ? (
                <CheckSquare className="w-5 h-5 text-green-600 shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-gray-300 shrink-0" />
              )}
              <CategoryIcon className="w-4 h-4 shrink-0" style={{ color: category.color }} />
              <span className={`${isSelected ? 'text-green-900' : 'text-gray-800'} truncate`}>{category.name}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
            >
              {isSelected ? (
                <CheckSquare className="w-5 h-5 text-green-600 shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-gray-300 shrink-0" />
              )}
              <CategoryIcon className="w-4 h-4 shrink-0" style={{ color: category.color }} />
              <span className={`${isSelected ? 'text-green-900' : 'text-gray-900'} truncate`}>{category.name}</span>
            </button>
          )}
        </div>

        {hasChildren && isExpanded && category.children.map((child) => renderCategoryOption(child, level + 1))}
      </div>
    );
  };

  return (
    <>
      {/* Bulk Action Bar */}
      {selectedTransactions.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-blue-700">
              {selectedTransactions.size} selected
            </span>
            <button
              onClick={clearSelection}
              className="p-1 hover:bg-blue-100 rounded"
            >
              <X className="w-4 h-4 text-blue-600" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkExport('csv')}
              className="bg-white"
            >
              <Download className="w-4 h-4 mr-1" />
              Export CSV
            </Button>
            {onBulkCategorize && (
              <Button
                size="sm"
                onClick={openBulkCategorizeModal}
              >
                <TagIcon className="w-4 h-4 mr-1" />
                Categorize
              </Button>
            )}
            {onBulkDelete && (
              <Button
                size="sm"
                variant="danger"
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No transactions found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Select All Header */}
              <div className="p-3 bg-gray-50 flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className="p-1 hover:bg-gray-200 rounded"
                  title={selectedTransactions.size === transactions.length ? 'Deselect all' : 'Select all'}
                >
                  {selectedTransactions.size === transactions.length ? (
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                <span className="text-sm text-gray-500">
                  {selectedTransactions.size === transactions.length
                    ? 'All selected'
                    : 'Select all'}
                </span>
              </div>

              {transactions.map((transaction) => {
                const transactionCategoryId = transaction.category?.id || transaction.categoryId || null;
                const resolvedCategoryColor = transaction.category
                  ? (transactionCategoryId ? (effectiveCategoryColors.get(transactionCategoryId) || transaction.category.color) : transaction.category.color)
                  : null;
                const resolvedCategoryIconName = transaction.category
                  ? (transactionCategoryId
                    ? (effectiveCategoryIcons.get(transactionCategoryId) || transaction.category.icon)
                    : transaction.category.icon)
                  : null;
                const CategoryIcon = getCategoryIcon(resolvedCategoryIconName);

                return (
                  <div
                    key={transaction.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${selectedTransactions.has(transaction.id) ? 'bg-blue-50' : ''
                      }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleSelect(transaction.id)}
                          className="p-1 hover:bg-gray-200 rounded shrink-0"
                        >
                          {selectedTransactions.has(transaction.id) ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>

                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          {getTypeIcon(transaction.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          {editingDescriptionId === transaction.id ? (
                            <input
                              type="text"
                              autoFocus
                              value={tempDescription}
                              onChange={(e) => setTempDescription(e.target.value)}
                              onBlur={(e) => handleDescriptionCommit(transaction.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  handleDescriptionCancel();
                                }
                              }}
                              className="w-full font-medium text-gray-900 border-b border-blue-500 focus:outline-none bg-transparent"
                            />
                          ) : (
                            <p
                              className="font-medium text-gray-900 line-clamp-1 cursor-text hover:text-blue-600 transition-colors"
                              onClick={() => {
                                setEditingDescriptionId(transaction.id);
                                setTempDescription(transaction.description);
                              }}
                            >
                              {transaction.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-500">
                              {formatDate(transaction.date)}
                            </span>
                            {transaction.category ? (
                              <button
                                type="button"
                                className="px-2 py-0.5 text-xs rounded-full hover:opacity-80 transition-opacity cursor-pointer inline-flex items-center gap-1"
                                style={{
                                  backgroundColor: `${resolvedCategoryColor}20`,
                                  color: resolvedCategoryColor || transaction.category.color,
                                }}
                                onClick={() => openCategorizeModal(transaction)}
                                title="Edit category"
                              >
                                <CategoryIcon className="w-3.5 h-3.5" />
                                {transaction.category.name}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                                onClick={() => openCategorizeModal(transaction)}
                                title="Set category"
                              >
                                <Tag className="w-3.5 h-3.5" />
                                Uncategorized
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-semibold ${transaction.type === 'INCOME' ? 'text-green-600' : 'text-gray-900'
                            }`}
                        >
                          {transaction.type === 'INCOME' ? '+' : '-'}
                          {formatCurrency(transaction.amount, { hideSensitiveValues })}
                        </p>
                        {transaction.account && (
                          <p className="text-xs text-gray-500">{transaction.account.name}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single Transaction Categorize Modal */}
      <Modal
        isOpen={!!categorizeModal}
        onClose={closeCategorizeModal}
        title="Categorize Transaction"
        size="xl"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Category</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Search categories..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={openCreateCategory}>
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            </div>

            {isCreateCategoryOpen && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Create Category</p>
                  <button
                    type="button"
                    onClick={closeCreateCategory}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Close
                  </button>
                </div>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">Parent</p>
                  <div className="max-h-32 overflow-y-auto pr-1">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setNewCategoryParentId('')}
                        className={`px-2.5 py-1.5 rounded-lg border text-sm inline-flex items-center gap-1.5 transition-colors ${newCategoryParentId === ''
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        <Tag className="w-3.5 h-3.5" />
                        Main category
                      </button>
                      {parentCategoryOptions.map((option) => {
                        const OptionIcon = getCategoryIcon(option.icon);
                        const isSelected = newCategoryParentId === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setNewCategoryParentId(option.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-sm inline-flex items-center gap-1.5 transition-colors ${isSelected
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                          >
                            <OptionIcon className="w-3.5 h-3.5" style={{ color: option.color }} />
                            <span>{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {createCategoryError && (
                  <p className="text-sm text-red-600">{createCategoryError}</p>
                )}
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={closeCreateCategory} disabled={isCreatingCategory}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={handleCreateCategory} disabled={isCreatingCategory || !newCategoryName.trim()}>
                    {isCreatingCategory ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
            )}

            <div className="max-h-[28rem] overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {showUncategorizedOption && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('')}
                  className={`w-full px-3 py-2.5 flex items-center gap-3 text-left cursor-pointer transition-colors ${selectedCategory === '' ? 'bg-green-50 hover:bg-green-50' : 'hover:bg-gray-50'
                    }`}
                >
                  <span className="w-5 h-5 shrink-0" />
                  {selectedCategory === '' ? (
                    <CheckSquare className="w-5 h-5 text-green-600 shrink-0" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-300 shrink-0" />
                  )}
                  <Tag className="w-4 h-4 shrink-0 text-gray-500" />
                  <span className={`${selectedCategory === '' ? 'text-green-900' : 'text-gray-900'}`}>
                    Uncategorized
                  </span>
                </button>
              )}

              {filteredCategoryTree.map((category) => renderCategoryOption(category))}

              {!showUncategorizedOption && filteredCategoryTree.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-gray-500">
                  <p>No categories found.</p>
                  <button
                    type="button"
                    onClick={openCreateCategory}
                    className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create a new category
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={applyToSimilar}
                onChange={(e) => setApplyToSimilar(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Apply to similar transactions
            </label>
            {applyToSimilar && (
              <>
                <input
                  type="text"
                  value={similarKeyword}
                  onChange={(e) => setSimilarKeyword(e.target.value)}
                  placeholder="Keyword (e.g. xfinity)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500">
                  Applies to transactions containing this keyword with the same transaction type.
                  {categorizeTargetTransaction ? ` Source: "${categorizeTargetTransaction.description}"` : ''}
                </p>
              </>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={closeCategorizeModal} disabled={isSavingCategorization}>
              Cancel
            </Button>
            <Button
              onClick={handleCategorize}
              disabled={isSavingCategorization || (applyToSimilar && similarKeyword.trim().length < 2)}
            >
              {isSavingCategorization ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Categorize Modal */}
      <Modal
        isOpen={bulkCategorizeModal}
        onClose={() => setBulkCategorizeModal(false)}
        title={`Categorize ${selectedTransactions.size} Transactions`}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a category to apply to all selected transactions.
          </p>
          <CategoryTreeSelector
            categories={categories}
            value={bulkCategory}
            onChange={setBulkCategory}
            transactionType={bulkTransactionType}
            allowParentSelection={false}
            includeUncategorized
            maxHeightClassName="max-h-72"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => setBulkCategorizeModal(false)}
              disabled={isSavingBulkCategorization}
            >
              Cancel
            </Button>
            <Button onClick={handleBulkCategorize} disabled={isSavingBulkCategorization}>
              {isSavingBulkCategorization ? 'Applying...' : 'Apply'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
