'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Folder, ChevronRight, ChevronDown, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, Modal, Input, Button } from '@/components/ui';
import { CategoryRules } from '@/components/categories/CategoryRules';
import { Category } from '@/types';

interface CategoryWithChildren extends Category {
    children?: CategoryWithChildren[];
    transactionCount?: number;
    budget?: number | null;
}

interface CategoryFormData {
    name: string;
    color: string;
    icon: string;
    parentId: string | null;
    budget: number | null;
}

const CATEGORY_ICONS = [
    'Utensils', 'ShoppingCart', 'Car', 'Fuel', 'Train', 'ShoppingBag', 'Shirt', 'Laptop', 'Home',
    'Film', 'Tv', 'Clapperboard', 'Gamepad2', 'Receipt', 'Zap', 'Droplet', 'Wifi', 'Phone', 'Building',
    'Heart', 'Stethoscope', 'Pill', 'Shield', 'Dumbbell', 'TrendingUp', 'Briefcase', 'PiggyBank',
    'ArrowRightLeft', 'Plus', 'Minus', 'MoreHorizontal', 'Wallet', 'CreditCard', 'Banknote',
    'Coffee', 'Pizza', 'Cake', 'Beer', 'Gift', 'Plane', 'Bed', 'Music', 'Book', 'GraduationCap',
];

const CATEGORY_COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#10B981', '#14B8A6',
    '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
    '#F43F5E', '#6B7280', '#64748B', '#78716C',
];

export default function CategoriesPage() {
    const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editModal, setEditModal] = useState<CategoryWithChildren | null>(null);
    const [deleteModal, setDeleteModal] = useState<CategoryWithChildren | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [formData, setFormData] = useState<CategoryFormData>({
        name: '',
        color: '#6B7280',
        icon: 'Tag',
        parentId: null,
        budget: null,
    });

    const fetchCategories = useCallback(async () => {
        try {
            const res = await fetch('/api/categories');
            const data = await res.json();

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

            setCategories(rootCategories);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

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
            setEditModal(category);
            setFormData({
                name: category.name,
                color: category.color,
                icon: category.icon || 'Tag',
                parentId: category.parentId || null,
                budget: category.budget || null,
            });
        } else {
            setEditModal({ id: '' } as CategoryWithChildren);
            setFormData({
                name: '',
                color: '#6B7280',
                icon: 'Tag',
                parentId: parentId || null,
                budget: null,
            });
        }
    };

    const renderCategory = (category: CategoryWithChildren, level: number = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        const isExpanded = expandedCategories.has(category.id);

        return (
            <div key={category.id}>
                <div
                    className={`flex items-center justify-between p-3 hover:bg-gray-50 transition-colors ${level > 0 ? 'ml-8 border-l-2 border-gray-200' : ''
                        }`}
                >
                    <div className="flex items-center gap-3">
                        {hasChildren && (
                            <button
                                onClick={() => toggleExpand(category.id)}
                                className="p-1 hover:bg-gray-200 rounded"
                            >
                                {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                )}
                            </button>
                        )}
                        {!hasChildren && <div className="w-6" />}

                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${category.color}20` }}
                        >
                            <Folder className="w-4 h-4" style={{ color: category.color }} />
                        </div>

                        <div>
                            <p className="font-medium text-gray-900">{category.name}</p>
                            {category.budget && (
                                <p className="text-xs text-gray-500">
                                    Budget: ${category.budget.toFixed(2)}/month
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => openEditModal(undefined, category.id)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Add subcategory"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => openEditModal(category)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Edit category"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setDeleteModal(category)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete category"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
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
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
                    <p className="text-gray-500 mt-1">Manage your transaction categories</p>
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
                />
                <CardContent className="p-0 divide-y divide-gray-100">
                    {categories.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <p>No categories yet. Click &ldquo;Add Category&rdquo; to create one.</p>
                        </div>
                    ) : (
                        categories.map((category) => renderCategory(category))
                    )}
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORY_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, color })}
                                    className={`w-8 h-8 rounded-lg border-2 transition-transform ${formData.color === color ? 'border-gray-900 scale-110' : 'border-transparent'
                                        }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg">
                            {CATEGORY_ICONS.map((icon) => (
                                <button
                                    key={icon}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, icon })}
                                    className={`p-2 rounded-lg border transition-colors ${formData.icon === icon
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    <Folder className="w-5 h-5" style={{ color: formData.color }} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Monthly Budget (optional)
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <p className="text-gray-600">
                        Are you sure you want to delete &ldquo;{deleteModal?.name}&rdquo;?
                    </p>
                    {deleteModal?.children && deleteModal.children.length > 0 && (
                        <p className="text-amber-600 text-sm">
                            Warning: This category has {deleteModal.children.length} subcategory(ies) that will also be deleted.
                        </p>
                    )}
                    <p className="text-gray-500 text-sm">
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
