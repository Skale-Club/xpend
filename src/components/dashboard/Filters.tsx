'use client';

import { useState } from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { Account, Category, DashboardFilters, TransactionType } from '@/types';

interface DashboardFiltersProps {
  accounts: Account[];
  categories: Category[];
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
}

export function DashboardFiltersPanel({
  accounts,
  categories,
  filters,
  onFiltersChange,
}: DashboardFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={filters.searchQuery || ''}
              onChange={(e) => updateFilter('searchQuery', e.target.value || undefined)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          className={isExpanded ? 'bg-gray-100' : ''}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
              Active
            </span>
          )}
          <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
          <Input
            label="Date From"
            type="date"
            value={filters.dateFrom ? new Date(filters.dateFrom).toISOString().split('T')[0] : ''}
            onChange={(e) => updateFilter('dateFrom', e.target.value ? new Date(e.target.value) : undefined)}
          />
          <Input
            label="Date To"
            type="date"
            value={filters.dateTo ? new Date(filters.dateTo).toISOString().split('T')[0] : ''}
            onChange={(e) => updateFilter('dateTo', e.target.value ? new Date(e.target.value) : undefined)}
          />
          <Select
            label="Account"
            value={filters.accountIds?.[0] || ''}
            onChange={(e) => updateFilter('accountIds', e.target.value ? [e.target.value] : undefined)}
            options={[
              { value: '', label: 'All Accounts' },
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
          <Select
            label="Category"
            value={filters.categoryIds?.[0] || ''}
            onChange={(e) => updateFilter('categoryIds', e.target.value ? [e.target.value] : undefined)}
            options={[
              { value: '', label: 'All Categories' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select
            label="Type"
            value={filters.transactionType || ''}
            onChange={(e) => updateFilter('transactionType', e.target.value as TransactionType || undefined)}
            options={[
              { value: '', label: 'All Types' },
              { value: 'INCOME', label: 'Income' },
              { value: 'EXPENSE', label: 'Expense' },
            ]}
          />
          <Input
            label="Min Amount"
            type="number"
            step="0.01"
            value={filters.minAmount || ''}
            onChange={(e) => updateFilter('minAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
          />
          <Input
            label="Max Amount"
            type="number"
            step="0.01"
            value={filters.maxAmount || ''}
            onChange={(e) => updateFilter('maxAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
          />
        </div>
      )}
    </div>
  );
}
