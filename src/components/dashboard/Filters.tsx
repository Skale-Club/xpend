'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Filter, X, ChevronDown, Calendar, ArrowRight, Tag, DollarSign } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { Account, Category, DashboardFilters, TransactionType } from '@/types';
import { CategoryTreeSelector } from '@/components/categories/CategoryTreeSelector';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

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
  const { hideSensitiveValues } = useSensitiveValues();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(filters.searchQuery || '');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const categoryFilterRef = useRef<HTMLDivElement | null>(null);

  const updateFilter = useCallback(<K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  }, [filters, onFiltersChange]);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      updateFilter('searchQuery', value || undefined);
    }, 500);
  };

  const clearFilters = () => {
    onFiltersChange({});
    setLocalSearch('');
  };

  const removeFilter = (key: keyof DashboardFilters) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
    if (key === 'searchQuery') setLocalSearch('');
  };

  const setQuickRange = (range: 'thisMonth' | 'lastMonth' | 'thisYear' | 'last30Days' | 'last7Days' | 'last90Days') => {
    const now = new Date();
    let from: Date | undefined;
    let to: Date | undefined = new Date();

    switch (range) {
      case 'thisMonth':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastMonth':
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisYear':
        from = new Date(now.getFullYear(), 0, 1);
        break;
      case 'last7Days':
        from = new Date();
        from.setDate(now.getDate() - 7);
        break;
      case 'last30Days':
        from = new Date();
        from.setDate(now.getDate() - 30);
        break;
      case 'last90Days':
        from = new Date();
        from.setDate(now.getDate() - 90);
        break;
    }

    onFiltersChange({ ...filters, dateFrom: from, dateTo: to });
  };

  const hasActiveFilters = Object.entries(filters).some(([, value]) => {
    if (value === undefined || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (['searchQuery', 'accountIds', 'categoryIds'].includes(key)) return false;
    if (value === undefined || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }).length;

  const formatDateLabel = (date: Date) => {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === filters.categoryIds?.[0]) || null,
    [categories, filters.categoryIds]
  );

  useEffect(() => {
    if (!isCategoryFilterOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!categoryFilterRef.current) return;
      if (categoryFilterRef.current.contains(event.target as Node)) return;
      setIsCategoryFilterOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isCategoryFilterOpen]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-4">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
          {/* Primary Filters (Always Visible) */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto flex-1">
            <div className="flex gap-3 w-full sm:w-auto">
              {/* Account Dropdown */}
              <div className="w-1/2 sm:w-44 md:w-52 shrink-0">
                <Select
                  value={filters.accountIds?.[0] || ''}
                  onChange={(e) => updateFilter('accountIds', e.target.value ? [e.target.value] : undefined)}
                  options={[
                    { value: '', label: 'All Accounts' },
                    ...accounts.map((a) => ({ value: a.id, label: a.name })),
                  ]}
                  className="h-10 text-sm"
                />
              </div>

              {/* Category Dropdown */}
              <div className="relative w-1/2 sm:w-44 md:w-52 shrink-0" ref={categoryFilterRef}>
                <button
                  type="button"
                  onClick={() => setIsCategoryFilterOpen((prev) => !prev)}
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg bg-white text-sm text-left flex items-center justify-between gap-2 hover:border-gray-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {selectedCategory ? (
                      <>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedCategory.color }} />
                        <span className="truncate">{selectedCategory.name}</span>
                      </>
                    ) : (
                      <span className="truncate">All Categories</span>
                    )}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isCategoryFilterOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCategoryFilterOpen && (
                  <div className="absolute z-30 mt-2 w-[24rem] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg p-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateFilter('categoryIds', undefined);
                        setIsCategoryFilterOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-sm text-left rounded-lg transition-colors ${!filters.categoryIds?.[0] ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
                    >
                      All Categories
                    </button>
                    <div className="mt-2">
                      <CategoryTreeSelector
                        categories={categories}
                        value={filters.categoryIds?.[0] || ''}
                        onChange={(categoryId) => {
                          updateFilter('categoryIds', categoryId ? [categoryId] : undefined);
                          setIsCategoryFilterOpen(false);
                        }}
                        transactionType={filters.transactionType || null}
                        includeUncategorized={false}
                        allowParentSelection
                        maxHeightClassName="max-h-72"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Main Search */}
            <div className="relative flex-1 w-full min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm h-10 hover:border-gray-300"
              />
            </div>
          </div>

          {/* Actions & More Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0 shrink-0">
            {/* Range Shortcuts */}
            <div className="hidden md:flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100 h-10">
              <button
                onClick={() => setQuickRange('last7Days')}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm rounded-md transition-all h-full flex items-center"
              >
                7D
              </button>
              <button
                onClick={() => setQuickRange('last30Days')}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm rounded-md transition-all h-full flex items-center"
              >
                30D
              </button>
              <button
                onClick={() => setQuickRange('thisMonth')}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm rounded-md transition-all h-full flex items-center"
              >
                This Month
              </button>
              <button
                onClick={() => setQuickRange('lastMonth')}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm rounded-md transition-all h-full flex items-center"
              >
                Last Month
              </button>
              <button
                onClick={() => setQuickRange('thisYear')}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm rounded-md transition-all h-full flex items-center"
              >
                This Year
              </button>
            </div>

            <Button
              variant="outline"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`text-sm h-10 shrink-0 bg-white focus:ring-blue-500 focus:ring-offset-0 ${isExpanded ? 'border-blue-300 bg-blue-50 text-blue-700' : ''}`}
            >
              <Filter className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">More Filters</span>
              <span className="sm:hidden">More</span>
              {activeFilterCount > 0 && (
                <span className="ml-2 w-5 h-5 flex items-center justify-center text-[10px] font-bold bg-blue-600 text-white rounded-full">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-4 h-4 ml-1 sm:ml-2 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="text-sm h-10 shrink-0 text-gray-500 hover:text-red-600 px-2 sm:px-4"
              >
                <X className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Date Group */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  Custom Date Range
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="date"
                      value={filters.dateFrom ? new Date(filters.dateFrom).toISOString().split('T')[0] : ''}
                      onChange={(e) => updateFilter('dateFrom', e.target.value ? new Date(e.target.value) : undefined)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
                    />
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
                  <div className="flex-1">
                    <input
                      type="date"
                      value={filters.dateTo ? new Date(filters.dateTo).toISOString().split('T')[0] : ''}
                      onChange={(e) => updateFilter('dateTo', e.target.value ? new Date(e.target.value) : undefined)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
                    />
                  </div>
                </div>
              </div>

              {/* Transaction Type Group */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-3 h-3" />
                  Transaction Type
                </p>
                <Select
                  value={filters.transactionType || ''}
                  onChange={(e) => updateFilter('transactionType', e.target.value as TransactionType || undefined)}
                  options={[
                    { value: '', label: 'All Types' },
                    { value: 'INCOME', label: 'Income Only' },
                    { value: 'EXPENSE', label: 'Expenses Only' },
                    { value: 'TRANSFER', label: 'Transfers Only' },
                  ]}
                  className="h-10 text-sm w-full"
                />
              </div>

              {/* Amount Group */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-3 h-3" />
                  Amount Range
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.minAmount || ''}
                      onChange={(e) => updateFilter('minAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                      className="w-full pl-6 pr-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
                    />
                  </div>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.maxAmount || ''}
                      onChange={(e) => updateFilter('maxAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                      className="w-full pl-6 pr-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs font-medium text-gray-500 mr-1">Active filters:</span>

          {filters.searchQuery && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100 text-xs font-medium">
              Search: &ldquo;{filters.searchQuery}&rdquo;
              <button onClick={() => removeFilter('searchQuery')} className="hover:text-blue-900">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {(filters.dateFrom || filters.dateTo) && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full border border-orange-100 text-xs font-medium">
              <Calendar className="w-3 h-3" />
              {filters.dateFrom ? formatDateLabel(filters.dateFrom) : '...'} - {filters.dateTo ? formatDateLabel(filters.dateTo) : 'Now'}
              <button
                onClick={() => {
                  const newFilters = { ...filters };
                  delete newFilters.dateFrom;
                  delete newFilters.dateTo;
                  onFiltersChange(newFilters);
                }}
                className="hover:text-orange-900"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {filters.categoryIds?.[0] && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full border border-green-100 text-xs font-medium">
              Category: {categories.find(c => c.id === filters.categoryIds?.[0])?.name || 'Selected'}
              <button onClick={() => removeFilter('categoryIds')} className="hover:text-green-900">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {filters.accountIds?.[0] && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-100 text-xs font-medium">
              Account: {accounts.find(a => a.id === filters.accountIds?.[0])?.name || 'Selected'}
              <button onClick={() => removeFilter('accountIds')} className="hover:text-purple-900">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {filters.transactionType && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 text-gray-700 rounded-full border border-gray-200 text-xs font-medium">
              Type: {filters.transactionType.charAt(0) + filters.transactionType.slice(1).toLowerCase()}
              <button onClick={() => removeFilter('transactionType')} className="hover:text-gray-900">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {(filters.minAmount !== undefined || filters.maxAmount !== undefined) && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 text-teal-700 rounded-full border border-teal-100 text-xs font-medium">
              Amount: {filters.minAmount !== undefined ? formatCurrency(filters.minAmount, { hideSensitiveValues, minimumFractionDigits: 0, maximumFractionDigits: 2 }) : 'Any'} - {filters.maxAmount !== undefined ? formatCurrency(filters.maxAmount, { hideSensitiveValues, minimumFractionDigits: 0, maximumFractionDigits: 2 }) : 'Any'}
              <button
                onClick={() => {
                  const newFilters = { ...filters };
                  delete newFilters.minAmount;
                  delete newFilters.maxAmount;
                  onFiltersChange(newFilters);
                }}
                className="hover:text-teal-900"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
