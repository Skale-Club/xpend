'use client';

import { useMemo, useState } from 'react';
import { CheckSquare, ChevronDown, ChevronRight, Search, Square, Tag } from 'lucide-react';
import { Category, TransactionType } from '@/types';
import { getCategoryIcon } from '@/lib/categoryIcons';

interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

interface CategoryTreeSelectorProps {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
  transactionType?: TransactionType | null;
  includeUncategorized?: boolean;
  allowParentSelection?: boolean;
  maxHeightClassName?: string;
  searchPlaceholder?: string;
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

function collectExpandableCategoryIds(nodes: CategoryTreeNode[], result: Set<string> = new Set()) {
  for (const node of nodes) {
    if (node.children.length > 0) {
      result.add(node.id);
      collectExpandableCategoryIds(node.children, result);
    }
  }
  return result;
}

function filterCategoryTree(nodes: CategoryTreeNode[], query: string): CategoryTreeNode[] {
  return nodes
    .map((node) => {
      const filteredChildren = filterCategoryTree(node.children, query);
      const selfMatches = node.name.toLowerCase().includes(query);

      if (selfMatches || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }

      return null;
    })
    .filter((node): node is CategoryTreeNode => node !== null);
}

export function CategoryTreeSelector({
  categories,
  value,
  onChange,
  transactionType = null,
  includeUncategorized = true,
  allowParentSelection = false,
  maxHeightClassName = 'max-h-[28rem]',
  searchPlaceholder = 'Search categories...',
}: CategoryTreeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const categoryTree = useMemo(() => {
    const categoryMap = new Map<string, CategoryTreeNode>();
    const rootNodes: CategoryTreeNode[] = [];

    for (const category of categories) {
      categoryMap.set(category.id, { ...category, children: [] });
    }

    for (const category of categories) {
      const node = categoryMap.get(category.id);
      if (!node) continue;

      if (category.parentId && categoryMap.has(category.parentId)) {
        categoryMap.get(category.parentId)?.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    const applyInheritedColors = (nodes: CategoryTreeNode[], parentColor?: string) => {
      for (const node of nodes) {
        if (parentColor) node.color = parentColor;
        if (node.children.length > 0) applyInheritedColors(node.children, node.color);
      }
    };
    applyInheritedColors(rootNodes);

    const sortTree = (nodes: CategoryTreeNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      for (const node of nodes) {
        if (node.children.length > 0) sortTree(node.children);
      }
    };
    sortTree(rootNodes);

    return rootNodes;
  }, [categories]);

  const allowedRootCategoryTree = useMemo(() => {
    if (!transactionType) return categoryTree;

    const filteredRoots = categoryTree.filter((rootCategory) => {
      const scope = classifyRootCategory(rootCategory.name);
      if (transactionType === 'INCOME') return scope === 'income';
      if (transactionType === 'TRANSFER') return scope === 'transfer';
      return scope === 'expense';
    });

    return filteredRoots.length > 0 ? filteredRoots : categoryTree;
  }, [categoryTree, transactionType]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredTree = useMemo(() => {
    if (!normalizedSearch) return allowedRootCategoryTree;
    return filterCategoryTree(allowedRootCategoryTree, normalizedSearch);
  }, [allowedRootCategoryTree, normalizedSearch]);

  const autoExpandedFilteredIds = useMemo(
    () => collectExpandableCategoryIds(filteredTree),
    [filteredTree]
  );

  const showUncategorized =
    includeUncategorized &&
    (normalizedSearch === '' || 'uncategorized'.includes(normalizedSearch));

  const renderCategory = (node: CategoryTreeNode, level = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = normalizedSearch
      ? autoExpandedFilteredIds.has(node.id)
      : expandedIds.has(node.id);
    const isSelected = value === node.id;
    const CategoryIcon = getCategoryIcon(node.icon);
    const isClickable = allowParentSelection || !hasChildren;

    return (
      <div key={node.id}>
        <div
          className={`w-full py-2.5 pr-3 flex items-center gap-3 transition-colors ${
            isSelected ? 'bg-green-50 hover:bg-green-50' : 'hover:bg-gray-50'
          }`}
          style={{ paddingLeft: `${12 + level * 20}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              disabled={!!normalizedSearch}
              onClick={() => {
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(node.id)) next.delete(node.id);
                  else next.add(node.id);
                  return next;
                });
              }}
              className={`p-0.5 rounded shrink-0 ${normalizedSearch ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-gray-200'}`}
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

          {isClickable ? (
            <button
              type="button"
              onClick={() => onChange(node.id)}
              className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
            >
              {isSelected ? (
                <CheckSquare className="w-5 h-5 text-green-600 shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-gray-300 shrink-0" />
              )}
              <CategoryIcon className="w-4 h-4 shrink-0" style={{ color: node.color }} />
              <span className={`${isSelected ? 'text-green-900' : 'text-gray-900'} truncate`}>{node.name}</span>
            </button>
          ) : (
            <div className="flex-1 min-w-0 flex items-center gap-3 text-left select-none">
              {isSelected ? (
                <CheckSquare className="w-5 h-5 text-green-600 shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-gray-300 shrink-0" />
              )}
              <CategoryIcon className="w-4 h-4 shrink-0" style={{ color: node.color }} />
              <span className={`${isSelected ? 'text-green-900' : 'text-gray-800'} truncate`}>{node.name}</span>
            </div>
          )}
        </div>

        {hasChildren && isExpanded && node.children.map((child) => renderCategory(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className={`${maxHeightClassName} overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100`}>
        {showUncategorized && (
          <button
            type="button"
            onClick={() => onChange('')}
            className={`w-full px-3 py-2.5 flex items-center gap-3 text-left cursor-pointer transition-colors ${
              value === '' ? 'bg-green-50 hover:bg-green-50' : 'hover:bg-gray-50'
            }`}
          >
            <span className="w-5 h-5 shrink-0" />
            {value === '' ? (
              <CheckSquare className="w-5 h-5 text-green-600 shrink-0" />
            ) : (
              <Square className="w-5 h-5 text-gray-300 shrink-0" />
            )}
            <Tag className="w-4 h-4 shrink-0 text-gray-500" />
            <span className={`${value === '' ? 'text-green-900' : 'text-gray-900'}`}>Uncategorized</span>
          </button>
        )}

        {filteredTree.map((category) => renderCategory(category))}

        {!showUncategorized && filteredTree.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-gray-500">
            No categories found.
          </div>
        )}
      </div>
    </div>
  );
}
