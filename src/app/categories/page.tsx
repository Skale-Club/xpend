'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Plus, Edit2, Trash2, ChevronRight, ChevronDown, Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, Modal, Input, Button, Loader, PeriodRangeFilter, Combobox } from '@/components/ui';
import { CategoryRules } from '@/components/categories/CategoryRules';
import { CategorySpendingBarChart } from '@/components/dashboard/Charts';
import { Category } from '@/types';
import { CATEGORY_ICONS, getCategoryIcon } from '@/lib/categoryIcons';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import { readArrayResponse } from '@/lib/http';
import { computeRange, type RangeId } from '@/lib/dateRange';

interface CategoryWithChildren extends Category {
    children?: CategoryWithChildren[];
    transactionCount?: number;
    budget?: number | null;
    spent?: number;
}

interface CategoryFormData {
    name: string;
    color: string;
    icon: string;
    parentId: string | null;
}

interface AccountOption {
    id: string;
    name: string;
}

function findCategoryById(
    nodes: CategoryWithChildren[],
    categoryId: string
): CategoryWithChildren | null {
    for (const node of nodes) {
        if (node.id === categoryId) return node;
        if (node.children?.length) {
            const found = findCategoryById(node.children, categoryId);
            if (found) return found;
        }
    }
    return null;
}

const CATEGORY_COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#10B981', '#14B8A6',
    '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
    '#F43F5E', '#6B7280', '#64748B', '#78716C',
];

type CategoryScope = 'income' | 'outcome';

function classifyRootCategory(name: string): CategoryScope {
    const normalized = name.toLowerCase();
    if (normalized.includes('income') || normalized.includes('receita') || normalized.includes('entrada')) {
        return 'income';
    }
    return 'outcome';
}

export default function CategoriesPage() {
    const { hideSensitiveValues } = useSensitiveValues();
    const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editModal, setEditModal] = useState<CategoryWithChildren | null>(null);
    const [deleteModal, setDeleteModal] = useState<CategoryWithChildren | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [activeScope, setActiveScope] = useState<CategoryScope>('outcome');
    const [rangeId, setRangeId] = useState<RangeId>('thisMonth');
    const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
    const [accounts, setAccounts] = useState<AccountOption[]>([]);
    const [accountId, setAccountId] = useState<string>('');
    const [formData, setFormData] = useState<CategoryFormData>({
        name: '',
        color: '#6B7280',
        icon: 'Tag',
        parentId: null,
    });

    const range = useMemo(
        () => (rangeId === 'custom' ? customRange : computeRange(rangeId)),
        [rangeId, customRange]
    );

    const fetchCategories = useCallback(async () => {
        try {
            const params = new URLSearchParams({ withSpending: '1' });
            params.set('type', activeScope === 'income' ? 'INCOME' : 'EXPENSE');
            if (range.from) params.set('dateFrom', range.from.toISOString());
            if (range.to) params.set('dateTo', range.to.toISOString());
            if (accountId) params.set('accountId', accountId);
            const res = await fetch(`/api/categories?${params.toString()}`);
            const data = await readArrayResponse<CategoryWithChildren>(res, 'Categories');

            // Build tree structure
            const categoryMap = new Map<string, CategoryWithChildren>();
            const rootCategories: CategoryWithChildren[] = [];

            // First pass: create map
            for (const cat of data) {
                categoryMap.set(cat.id, { ...cat, children: [] });
            }

            // Second pass: build tree
            for (const cat of data) {
                const node = categoryMap.get(cat.id)!;
                if (cat.parentId && categoryMap.has(cat.parentId)) {
                    const parent = categoryMap.get(cat.parentId)!;
                    if (!parent.children) parent.children = [];
                    parent.children.push(node);
                } else {
                    rootCategories.push(node);
                }
            }

            // Subcategories inherit parent color in the UI tree representation.
            const applyInheritedColors = (
                nodes: CategoryWithChildren[],
                parentColor?: string
            ) => {
                for (const node of nodes) {
                    if (parentColor) node.color = parentColor;
                    if (node.children?.length) {
                        applyInheritedColors(node.children, node.color);
                    }
                }
            };
            applyInheritedColors(rootCategories);

            setCategories(rootCategories);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
            setCategories([]);
        } finally {
            setIsLoading(false);
        }
    }, [range, activeScope, accountId]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        fetch('/api/accounts')
            .then((res) => readArrayResponse<AccountOption>(res, 'Accounts'))
            .then(setAccounts)
            .catch(() => setAccounts([]));
    }, []);

    const toggleExpand = (categoryId: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            return next;
        });
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return;

        setIsSaving(true);
        try {
            const url = editModal?.id ? `/api/categories/${editModal.id}` : '/api/categories';
            const method = editModal?.id ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                setEditModal(null);
                setFormData({
                    name: '',
                    color: '#6B7280',
                    icon: 'Tag',
                    parentId: null,
                });
                fetchCategories();
            }
        } catch (error) {
            console.error('Failed to save category:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteModal) return;

        setIsSaving(true);
        try {
            const res = await fetch(`/api/categories/${deleteModal.id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                setDeleteModal(null);
                fetchCategories();
            }
        } catch (error) {
            console.error('Failed to delete category:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const openEditModal = (category?: CategoryWithChildren, parentId?: string) => {
        if (category) {
            const parentColor = category.parentId
                ? findCategoryById(categories, category.parentId)?.color
                : null;
            setEditModal(category);
            setFormData({
                name: category.name,
                color: parentColor || category.color,
                icon: category.icon || 'Tag',
                parentId: category.parentId || null,
            });
        } else {
            const parentColor = parentId
                ? findCategoryById(categories, parentId)?.color
                : null;
            setEditModal({ id: '' } as CategoryWithChildren);
            setFormData({
                name: '',
                color: parentColor || '#6B7280',
                icon: 'Tag',
                parentId: parentId || null,
            });
        }
    };

    const selectedParent = formData.parentId
        ? findCategoryById(categories, formData.parentId)
        : null;

    const visibleRootCategories = useMemo(() => {
        const filtered = categories.filter((category) => classifyRootCategory(category.name) === activeScope);
        return filtered.length > 0 ? filtered : categories;
    }, [categories, activeScope]);

    // Ranked spending per root category — pure actuals, no budget overlay.
    const chartData = useMemo(
        () =>
            visibleRootCategories
                .map((category) => ({
                    name: category.name,
                    value: category.spent ?? 0,
                    color: category.color,
                }))
                .filter((d) => d.value > 0)
                .sort((a, b) => b.value - a.value),
        [visibleRootCategories]
    );

    const renderCategory = (category: CategoryWithChildren, level: number = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        const isExpanded = expandedCategories.has(category.id);

        const spent = category.spent ?? 0;

        return (
            <div key={category.id}>
                <div
                    className={`py-3 pr-3 hover:bg-muted transition-colors ${level > 0 ? 'border-l-2 border-border' : ''
                        }`}
                    style={{ paddingLeft: `${12 + level * 28}px` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        {hasChildren && (
                            <button
                                onClick={() => toggleExpand(category.id)}
                                className="p-1 hover:bg-muted rounded"
                            >
                                {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                )}
                            </button>
                        )}
                        {!hasChildren && <div className="w-6" />}

                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${category.color}20` }}
                        >
                            {(() => {
                                const IconComponent = getCategoryIcon(category.icon || 'Tag');
                                return <IconComponent className="w-4 h-4" style={{ color: category.color }} />;
                            })()}
                        </div>

                        <div className="min-w-0">
                            <p className="font-medium text-foreground">{category.name}</p>
                            {spent > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Spent: {formatCurrency(spent, { hideSensitiveValues })}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => openEditModal(undefined, category.id)}
                            className="p-2 text-muted-foreground/70 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Add subcategory"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => openEditModal(category)}
                            className="p-2 text-muted-foreground/70 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Edit category"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setDeleteModal(category)}
                            className="p-2 text-muted-foreground/70 hover:text-destructive hover:bg-red-50 rounded-lg"
                            title="Delete category"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </div>
                </div>

                {hasChildren && isExpanded && (
                    <div>
                        {category.children!.map((child) => renderCategory(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] w-full">
                <Loader size={80} />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground">Categories</h1>
                    <p className="text-muted-foreground mt-1">Manage your transaction categories</p>
                </div>
                <Button onClick={() => openEditModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Category
                </Button>
            </div>

            <Card>
                <CardHeader
                    title={activeScope === 'income' ? 'Income by category' : 'Spending by category'}
                    subtitle="Actual totals for the selected period"
                    action={
                        <div className="inline-flex rounded-lg border border-border bg-muted p-1 shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveScope('outcome')}
                                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeScope === 'outcome'
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Outcome
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveScope('income')}
                                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeScope === 'income'
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Income
                            </button>
                        </div>
                    }
                />
                <CardContent className="p-0">
                    <div className="flex flex-col gap-3 px-4 py-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
                        <PeriodRangeFilter
                            rangeId={rangeId}
                            customRange={customRange}
                            onRangeChange={(id, custom) => {
                                setRangeId(id);
                                setCustomRange(custom);
                            }}
                        />
                        <div className="w-full sm:w-56 shrink-0">
                            <Combobox
                                value={accountId}
                                onChange={setAccountId}
                                icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
                                placeholder="All accounts"
                                searchPlaceholder="Search accounts…"
                                options={[
                                    { value: '', label: 'All accounts' },
                                    ...accounts.map((account) => ({ value: account.id, label: account.name })),
                                ]}
                            />
                        </div>
                    </div>
                    <div className="p-4">
                        {chartData.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                <p>No {activeScope === 'income' ? 'income' : 'spending'} in this period.</p>
                            </div>
                        ) : (
                            <CategorySpendingBarChart data={chartData} />
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader
                    title="Category List"
                    subtitle="Manage your transaction categories"
                />
                <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                        {visibleRootCategories.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <p>No categories yet. Click &ldquo;Add Category&rdquo; to create one.</p>
                            </div>
                        ) : (
                            visibleRootCategories.map((category) => renderCategory(category))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Category Rules Section */}
            <CategoryRules />

            {/* Edit/Create Modal */}
            <Modal
                isOpen={!!editModal}
                onClose={() => setEditModal(null)}
                title={editModal?.id ? 'Edit Category' : 'Create Category'}
                size="md"
            >
                <div className="space-y-4">
                    <Input
                        label="Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Category name"
                    />

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Color</label>
                        {formData.parentId ? (
                            <div className="rounded-lg border border-border bg-muted p-3">
                                <p className="text-sm text-muted-foreground">
                                    This subcategory inherits color from {selectedParent?.name || 'its parent'}.
                                </p>
                                <div className="mt-2 flex items-center gap-2">
                                    <span
                                        className="w-4 h-4 rounded-full border border-white shadow-sm"
                                        style={{ backgroundColor: formData.color }}
                                    />
                                    <span className="text-sm font-medium text-muted-foreground">{formData.color}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {CATEGORY_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, color })}
                                        className={`w-8 h-8 rounded-lg border-2 transition-transform ${formData.color === color ? 'border-foreground scale-110' : 'border-transparent'
                                            }`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Icon</label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg">
                            {CATEGORY_ICONS.map((iconName) => {
                                const IconComponent = getCategoryIcon(iconName);
                                return (
                                    <button
                                        key={iconName}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, icon: iconName })}
                                        className={`p-2 rounded-lg border transition-colors ${formData.icon === iconName
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-border hover:bg-muted'
                                            }`}
                                        title={iconName}
                                    >
                                        <IconComponent className="w-5 h-5" style={{ color: formData.color }} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-4 border-t">
                        <Button variant="secondary" onClick={() => setEditModal(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || !formData.name.trim()}>
                            {isSaving ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!deleteModal}
                onClose={() => setDeleteModal(null)}
                title="Delete Category"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-muted-foreground">
                        Are you sure you want to delete &ldquo;{deleteModal?.name}&rdquo;?
                    </p>
                    {deleteModal?.children && deleteModal.children.length > 0 && (
                        <p className="text-amber-600 text-sm">
                            Warning: This category has {deleteModal.children.length} subcategory(ies) that will also be deleted.
                        </p>
                    )}
                    <p className="text-muted-foreground text-sm">
                        Transactions in this category will become uncategorized.
                    </p>
                    <div className="flex gap-2 justify-end pt-4 border-t">
                        <Button variant="secondary" onClick={() => setDeleteModal(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleDelete}
                            disabled={isSaving}
                        >
                            {isSaving ? 'Deleting...' : 'Delete'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
