'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Plus, Edit2, Trash2, ChevronRight, ChevronDown, DollarSign, Calendar,
} from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, Modal, Input, Button, Loader } from '@/components/ui';
import { CategoryRules } from '@/components/categories/CategoryRules';
import { Category } from '@/types';
import { CATEGORY_ICONS, getCategoryIcon } from '@/lib/categoryIcons';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import { readArrayResponse } from '@/lib/http';

interface CategoryWithChildren extends Category {
    children?: CategoryWithChildren[];
    transactionCount?: number;
    budget?: number | null;
    spent?: number;
}

type RangeId = 'thisMonth' | 'lastMonth' | 'last3Months' | 'last6Months' | 'thisYear' | 'allTime' | 'custom';

const RANGE_PRESETS: { id: Exclude<RangeId, 'custom'>; label: string }[] = [
    { id: 'thisMonth', label: 'This month' },
    { id: 'lastMonth', label: 'Last month' },
    { id: 'last3Months', label: 'Last 3 months' },
    { id: 'last6Months', label: 'Last 6 months' },
    { id: 'thisYear', label: 'This year' },
    { id: 'allTime', label: 'All time' },
];

function computeRange(id: Exclude<RangeId, 'custom'>, now: Date = new Date()): { from?: Date; to?: Date } {
    switch (id) {
        case 'thisMonth': return { from: startOfMonth(now), to: now };
        case 'lastMonth': { const d = subMonths(now, 1); return { from: startOfMonth(d), to: endOfMonth(d) }; }
        case 'last3Months': return { from: startOfMonth(subMonths(now, 2)), to: now };
        case 'last6Months': return { from: startOfMonth(subMonths(now, 5)), to: now };
        case 'thisYear': return { from: startOfYear(now), to: now };
        case 'allTime': return { from: undefined, to: undefined };
    }
}

// Number of calendar months a finite range spans (inclusive). Used to prorate
// the monthly budget so the progress bar compares like-for-like.
function monthsInRange(from?: Date, to?: Date): number | null {
    if (!from || !to) return null;
    return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
}

interface CategoryFormData {
    name: string;
    color: string;
    icon: string;
    parentId: string | null;
    budget: number | null;
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
    const [formData, setFormData] = useState<CategoryFormData>({
        name: '',
        color: '#6B7280',
        icon: 'Tag',
        parentId: null,
        budget: null,
    });

    const range = useMemo(
        () => (rangeId === 'custom' ? customRange : computeRange(rangeId)),
        [rangeId, customRange]
    );
    const months = useMemo(() => monthsInRange(range.from, range.to), [range]);

    const fetchCategories = useCallback(async () => {
        try {
            const params = new URLSearchParams({ withSpending: '1' });
            if (range.from) params.set('dateFrom', range.from.toISOString());
            if (range.to) params.set('dateTo', range.to.toISOString());
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
    }, [range]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

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
                    budget: null,
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
                budget: category.budget || null,
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
                budget: null,
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

    const renderCategory = (category: CategoryWithChildren, level: number = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        const isExpanded = expandedCategories.has(category.id);

        const spent = category.spent ?? 0;
        const hasBudget = category.budget != null && category.budget > 0;
        const budgetForPeriod =
            hasBudget && months != null ? (category.budget as number) * months : null;
        const pct = budgetForPeriod && budgetForPeriod > 0 ? (spent / budgetForPeriod) * 100 : null;
        const barColor = pct == null ? '#9CA3AF' : pct <= 75 ? '#22C55E' : pct <= 100 ? '#F59E0B' : '#EF4444';

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
                            {hasBudget ? (
                                <div className="mt-1.5 w-44 sm:w-56">
                                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                                        <span className="text-muted-foreground">
                                            {formatCurrency(spent, { hideSensitiveValues })}
                                            {budgetForPeriod != null
                                                ? ` of ${formatCurrency(budgetForPeriod, { hideSensitiveValues })}`
                                                : ` · budget ${formatCurrency(category.budget as number, { hideSensitiveValues })}/mo`}
                                        </span>
                                        {pct != null && (
                                            <span className="font-medium" style={{ color: barColor }}>
                                                {Math.round(pct)}%
                                            </span>
                                        )}
                                    </div>
                                    {budgetForPeriod != null && (
                                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{ width: `${Math.min(100, pct ?? 0)}%`, backgroundColor: barColor }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                spent > 0 && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Spent: {formatCurrency(spent, { hideSensitiveValues })}
                                    </p>
                                )
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
                    title="Category List"
                    subtitle="Manage your transaction categories"
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
                    {/* Date range filter for budget spending */}
                    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mr-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Period
                        </div>
                        {RANGE_PRESETS.map(({ id, label }) => {
                            const isActive = rangeId === id;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setRangeId(id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${isActive
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-muted text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                        <div className="flex items-center gap-1.5 ml-auto">
                            <input
                                type="date"
                                value={customRange.from ? customRange.from.toISOString().split('T')[0] : ''}
                                onChange={(e) => {
                                    setRangeId('custom');
                                    setCustomRange((prev) => ({
                                        ...prev,
                                        from: e.target.value ? new Date(e.target.value) : undefined,
                                    }));
                                }}
                                className="px-2.5 py-1.5 text-xs border border-border rounded-lg bg-card text-foreground [color-scheme:light] dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-ring/20"
                            />
                            <span className="text-muted-foreground/50 text-xs">—</span>
                            <input
                                type="date"
                                value={customRange.to ? customRange.to.toISOString().split('T')[0] : ''}
                                onChange={(e) => {
                                    setRangeId('custom');
                                    setCustomRange((prev) => ({
                                        ...prev,
                                        to: e.target.value ? endOfDay(new Date(e.target.value)) : undefined,
                                    }));
                                }}
                                className="px-2.5 py-1.5 text-xs border border-border rounded-lg bg-card text-foreground [color-scheme:light] dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-ring/20"
                            />
                        </div>
                    </div>
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

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Monthly Budget (optional)
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                            <input
                                type="number"
                                value={formData.budget || ''}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        budget: e.target.value ? parseFloat(e.target.value) : null,
                                    })
                                }
                                placeholder="0.00"
                                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                            />
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
