'use client';

import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, ArrowRight, Tag, CheckSquare, Square, X, TagIcon } from 'lucide-react';
import { Card, CardContent, Modal, Select, Button } from '@/components/ui';
import { Transaction, Category } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  onCategorize: (transactionId: string, categoryId: string | null) => void;
  onBulkCategorize?: (transactionIds: string[], categoryId: string | null) => void;
}

export function TransactionList({ transactions, categories, onCategorize, onBulkCategorize }: TransactionListProps) {
  const [categorizeModal, setCategorizeModal] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [bulkCategorizeModal, setBulkCategorizeModal] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<string>('');

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

  const handleCategorize = () => {
    if (categorizeModal) {
      onCategorize(categorizeModal, selectedCategory || null);
      setCategorizeModal(null);
      setSelectedCategory('');
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

  const handleBulkCategorize = () => {
    if (onBulkCategorize && selectedTransactions.size > 0) {
      onBulkCategorize(Array.from(selectedTransactions), bulkCategory || null);
      setSelectedTransactions(new Set());
      setBulkCategorizeModal(false);
      setBulkCategory('');
    }
  };

  const clearSelection = () => {
    setSelectedTransactions(new Set());
  };

  return (
    <>
      {/* Bulk Action Bar */}
      {selectedTransactions.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
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
          <Button
            size="sm"
            onClick={() => setBulkCategorizeModal(true)}
          >
            <TagIcon className="w-4 h-4 mr-1" />
            Categorize Selected
          </Button>
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

              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${selectedTransactions.has(transaction.id) ? 'bg-blue-50' : ''
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSelect(transaction.id)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {selectedTransactions.has(transaction.id) ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>

                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        {getTypeIcon(transaction.type)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 line-clamp-1">
                          {transaction.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-gray-500">
                            {formatDate(transaction.date)}
                          </span>
                          {transaction.category ? (
                            <span
                              className="px-2 py-0.5 text-xs rounded-full"
                              style={{
                                backgroundColor: `${transaction.category.color}20`,
                                color: transaction.category.color,
                              }}
                            >
                              {transaction.category.name}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">
                              Uncategorized
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p
                          className={`font-semibold ${transaction.type === 'INCOME' ? 'text-green-600' : 'text-gray-900'
                            }`}
                        >
                          {transaction.type === 'INCOME' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </p>
                        {transaction.account && (
                          <p className="text-xs text-gray-500">{transaction.account.name}</p>
                        )}
                      </div>
                      <button
                        className="p-1 rounded-lg hover:bg-gray-100"
                        onClick={() => {
                          setCategorizeModal(transaction.id);
                          setSelectedCategory(transaction.categoryId || '');
                        }}
                        title="Categorize"
                      >
                        <Tag className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single Transaction Categorize Modal */}
      <Modal
        isOpen={!!categorizeModal}
        onClose={() => setCategorizeModal(null)}
        title="Categorize Transaction"
        size="sm"
      >
        <div className="space-y-4">
          <Select
            label="Category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            options={[
              { value: '', label: 'Uncategorized' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setCategorizeModal(null)}>
              Cancel
            </Button>
            <Button onClick={handleCategorize}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Categorize Modal */}
      <Modal
        isOpen={bulkCategorizeModal}
        onClose={() => setBulkCategorizeModal(false)}
        title={`Categorize ${selectedTransactions.size} Transactions`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a category to apply to all selected transactions.
          </p>
          <Select
            label="Category"
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            options={[
              { value: '', label: 'Uncategorized' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setBulkCategorizeModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkCategorize}>
              Apply
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
