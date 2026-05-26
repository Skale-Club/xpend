'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Filter, X, ChevronDown, Calendar, ArrowRight, Tag, DollarSign, Wallet } from 'lucide-react';
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
  const [activeRange, setActiveRange] = useState<string | null>(null);
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
    setActiveRange(null);
  };

  const removeFilter = (key: keyof DashboardFilters) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
    if (key === 'searchQuery') setLocalSearch('');
  };

  const setQuickRange = (range: 'thisMonth' | 'lastMonth' | 'thisYear' | 'last30Days' | 'last7Days' | 'last90Days', label?: string) => {
    setActiveRange(label ?? range);
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

  const SHORTCUTS = [
    { label: '7D',        range: 'last7Days'  as const },
    { label: '30D',       range: 'last30Days' as const },
    { label: 'This Month', range: 'thisMonth'  as const },
    { label: 'Last Month', range: 'lastMonth'  as const },
    { label: 'This Year', range: 'thisYear'   as const },
  ];

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-30 bg-muted/95 backdrop-blur-sm py-2">
        <div className="bg-card rounded-2xl shadow-sm border border-border/60 p-3 space-y-3">

          {/* Row 1: Account + Category + Search */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Account */}
            <div className="relative sm:w-48 shrink-0">
              <Wallet className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <select
                value={filters.accountIds?.[0] || ''}
                onChange={(e) => updateFilter('accountIds', e.target.value ? [e.target.value] : undefined)}
                className="w-full h-10 pl-9 pr-8 text-sm border border-border rounded-xl bg-card text-muted-foreground appearance-none cursor-pointer hover:border-border focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary/50 transition-colors"
              >
                <option value="">All Accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70" />
            </div>

            {/* Category */}
            <div className="relative sm:w-48 shrink-0" ref={categoryFilterRef}>
              <Tag className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 z-10" />
              <button
                type="button"
                onClick={() => setIsCategoryFilterOpen((prev) => !prev)}
                className="w-full h-10 pl-9 pr-8 border border-border rounded-xl bg-card text-sm text-left flex items-center hover:border-border focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary/50 transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  {selectedCategory ? (
                    <>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedCategory.color }} />
                      <span className="truncate text-muted-foreground">{selectedCategory.name}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">All Categories</span>
                  )}
                </span>
                <ChevronDown className={`absolute right-2.5 w-3.5 h-3.5 text-muted-foreground/70 transition-transform ${isCategoryFilterOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCategoryFilterOpen && (
                <div className="absolute z-30 mt-2 w-[24rem] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-lg p-2">
                  <button
                    type="button"
                    onClick={() => { updateFilter('categoryIds', undefined); setIsCategoryFilterOpen(false); }}
                    className={`w-full px-3 py-2 text-sm text-left rounded-lg transition-colors ${!filters.categoryIds?.[0] ? 'bg-accent text-accent-foreground' : 'hover:bg-muted text-muted-foreground'}`}
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

            {/* Search */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full h-10 pl-9 pr-4 border border-border rounded-xl bg-card text-sm text-muted-foreground placeholder:text-muted-foreground/70 hover:border-border focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary/50 transition-colors"
              />
            </div>
          </div>

          {/* Row 2: Date shortcuts + More Filters + Clear */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Shortcuts */}
            <div className="flex items-center gap-1 flex-wrap">
              {SHORTCUTS.map(({ label, range }) => {
                const isActive = activeRange === label;
                return (
                  <button
                    key={range}
                    onClick={() => setQuickRange(range, label)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                        : 'bg-muted text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isExpanded || activeFilterCount > 0
                    ? 'border-primary/50 bg-accent text-accent-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-border hover:bg-muted'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 flex items-center justify-center text-[10px] font-bold bg-blue-600 text-white rounded-full">
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>
          {isExpanded && (
            <div className="pt-3 border-t border-border">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Date Group */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    Custom Date Range
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={filters.dateFrom ? new Date(filters.dateFrom).toISOString().split('T')[0] : ''}
                      onChange={(e) => { updateFilter('dateFrom', e.target.value ? new Date(e.target.value) : undefined); setActiveRange(null); }}
                      className="flex-1 px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary/50 h-10 transition-colors"
                    />
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    <input
                      type="date"
                      value={filters.dateTo ? new Date(filters.dateTo).toISOString().split('T')[0] : ''}
                      onChange={(e) => { updateFilter('dateTo', e.target.value ? new Date(e.target.value) : undefined); setActiveRange(null); }}
                      className="flex-1 px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary/50 h-10 transition-colors"
                    />
                  </div>
                </div>

                {/* Transaction Type Group */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
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
                    className="h-10 text-sm w-full rounded-xl"
                  />
                </div>

                {/* Amount Group */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3" />
                    Amount Range
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 text-xs">$</span>
                      <input
                        type="number"
                        placeholder="Min"
                        value={filters.minAmount || ''}
                        onChange={(e) => updateFilter('minAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                        className="w-full pl-6 pr-2 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary/50 h-10 transition-colors"
                      />
                    </div>
                    <span className="text-muted-foreground/40 text-xs">—</span>
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 text-xs">$</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={filters.maxAmount || ''}
                        onChange={(e) => updateFilter('maxAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                        className="w-full pl-6 pr-2 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary/50 h-10 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs font-medium text-muted-foreground mr-1">Active filters:</span>

          {filters.searchQuery && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent text-accent-foreground rounded-full border border-blue-100 text-xs font-medium">
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
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted text-muted-foreground rounded-full border border-border text-xs font-medium">
              Type: {filters.transactionType.charAt(0) + filters.transactionType.slice(1).toLowerCase()}
              <button onClick={() => removeFilter('transactionType')} className="hover:text-foreground">
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
