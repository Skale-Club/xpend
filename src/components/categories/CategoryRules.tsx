'use client';

import { useEffect, useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Tag, Search, ArrowUpDown, ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, Modal, Input, Button, Select, Pagination, Loader } from '@/components/ui';
import { getCategoryIcon } from '@/lib/categoryIcons';
import { CategoryTreeSelector } from './CategoryTreeSelector';
import React from 'react';

interface CategorizationRule {
    id: string;
    categoryId: string;
    keywords: string;
    matchType: string;
    priority: number;
    isActive: boolean;
    category: {
        id: string;
        name: string;
        color: string;
        icon: string | null;
        parentId?: string | null;
    };
}

interface Category {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    parentId?: string | null;
}

export function CategoryRules() {
    const [rules, setRules] = useState<CategorizationRule[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editModal, setEditModal] = useState<CategorizationRule | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // New states for organization
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const itemsPerPage = 15;

    const [formData, setFormData] = useState({
        keywords: '',
        categoryId: '',
        matchType: 'contains',
        priority: 0,
    });

    const fetchData = async () => {
        try {
            const [rulesRes, categoriesRes] = await Promise.all([
                fetch('/api/categorization-rules'),
                fetch('/api/categories'),
            ]);
            const rulesData = await rulesRes.json();
            const categoriesData = await categoriesRes.json();
            setRules(rulesData);
            setCategories(categoriesData);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleCategory = (categoryId: string) => {
        const next = new Set(expandedCategories);
        if (next.has(categoryId)) {
            next.delete(categoryId);
        } else {
            next.add(categoryId);
        }
        setExpandedCategories(next);
    };

    // Filter, group, and sort logic
    const groupedAndFilteredRules = useMemo(() => {
        let filtered = rules;

        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.toLowerCase();
            filtered = rules.filter(r =>
                r.keywords.toLowerCase().includes(lowerQuery) ||
                r.category.name.toLowerCase().includes(lowerQuery)
            );
        }

        // Group by category
        const groups = new Map<string, { category: Category, rules: CategorizationRule[] }>();

        filtered.forEach(rule => {
            const catId = rule.category.id;
            if (!groups.has(catId)) {
                // Find full category details from categories state to get icon
                const fullCat = categories.find(c => c.id === catId) || rule.category as Category;
                groups.set(catId, { category: fullCat, rules: [] });
            }
            groups.get(catId)!.rules.push(rule);
        });

        // Sort rules inside each group by keyword
        groups.forEach(group => {
            group.rules.sort((a, b) => a.keywords.localeCompare(b.keywords));
        });

        // Sort groups by category name
        return Array.from(groups.values()).sort((a, b) => a.category.name.localeCompare(b.category.name));
    }, [rules, searchQuery, categories]);

    // Flatten for pagination but keep structure for rendering
    const flattenedView = useMemo(() => {
        const items: any[] = [];
        groupedAndFilteredRules.forEach(group => {
            items.push({ type: 'header', category: group.category, count: group.rules.length });
            if (expandedCategories.has(group.category.id) || searchQuery) {
                group.rules.forEach(rule => items.push({ type: 'rule', rule }));
            }
        });
        return items;
    }, [groupedAndFilteredRules, expandedCategories, searchQuery]);

    const totalPages = Math.ceil(flattenedView.length / itemsPerPage);
    const paginatedItems = flattenedView.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset pagination on search
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const handleSave = async () => {
        if (!formData.keywords.trim() || !formData.categoryId) return;

        setIsSaving(true);
        try {
            const url = editModal?.id ? `/api/categorization-rules?id=${editModal.id}` : '/api/categorization-rules';
            const method = editModal?.id ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    keywords: formData.keywords.toLowerCase() // normalize keywords
                }),
            });

            if (res.ok) {
                setEditModal(null);
                setFormData({
                    keywords: '',
                    categoryId: '',
                    matchType: 'contains',
                    priority: 0,
                });
                fetchData();
            }
        } catch (error) {
            console.error('Failed to save rule:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (ruleId: string) => {
        if (!confirm('Are you sure you want to delete this rule?')) return;

        try {
            const res = await fetch(`/api/categorization-rules?id=${ruleId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                fetchData();
            }
        } catch (error) {
            console.error('Failed to delete rule:', error);
        }
    };

    const openEditModal = (rule?: CategorizationRule) => {
        if (rule) {
            setEditModal(rule);
            setFormData({
                keywords: rule.keywords,
                categoryId: rule.categoryId,
                matchType: rule.matchType,
                priority: rule.priority,
            });
        } else {
            setEditModal({ id: '' } as CategorizationRule);
            setFormData({
                keywords: '',
                categoryId: '',
                matchType: 'contains',
                priority: 0,
            });
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-32">
                <Loader size={60} />
            </div>
        );
    }

    return (
        <>
            <Card>
                <CardHeader
                    title="Categorization Rules"
                    subtitle={`${rules.length} active rules configured`}
                    action={
                        <Button size="sm" onClick={() => openEditModal()}>
                            <Plus className="w-4 h-4 mr-1" />
                            Add Rule
                        </Button>
                    }
                />

                {rules.length > 0 && (
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                        <div className="relative max-w-md">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by keyword or category..."
                                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                            />
                        </div>
                    </div>
                )}

                <CardContent className="p-0">
                    {rules.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <ArrowUpDown className="w-6 h-6 text-gray-400" />
                            </div>
                            <p className="font-medium text-gray-900">No categorization rules yet</p>
                            <p className="text-sm mt-1 max-w-md mx-auto">Create rules to automatically categorize your transactions based on keywords found in their description.</p>
                            <Button className="mt-4" onClick={() => openEditModal()}>
                                <Plus className="w-4 h-4 mr-2" />
                                Create First Rule
                            </Button>
                        </div>
                    ) : flattenedView.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <p>No rules found matching "{searchQuery}"</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {paginatedItems.map((item, index) => {
                                if (item.type === 'header') {
                                    const cat = item.category;
                                    const isExpanded = expandedCategories.has(cat.id) || !!searchQuery;
                                    const CategoryIcon = getCategoryIcon(cat.icon);

                                    return (
                                        <div
                                            key={`header-${cat.id}`}
                                            className={`flex items-center gap-3 p-3 bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors ${searchQuery ? 'pointer-events-none' : ''}`}
                                            onClick={() => !searchQuery && toggleCategory(cat.id)}
                                        >
                                            {!searchQuery && (
                                                isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
                                            )}
                                            {searchQuery && <div className="w-4 h-4" />}
                                            <div
                                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                style={{ backgroundColor: `${cat.color}20` }}
                                            >
                                                <CategoryIcon className="w-4 h-4" style={{ color: cat.color }} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-semibold text-gray-900">{cat.name}</p>
                                                <p className="text-xs text-gray-500">{item.count} rule{item.count !== 1 ? 's' : ''}</p>
                                            </div>
                                        </div>
                                    );
                                } else {
                                    const rule = item.rule;
                                    return (
                                        <div key={rule.id} className="flex items-center justify-between p-4 hover:bg-blue-50/30 transition-colors group">
                                            <div className="flex items-center gap-3 pl-8">
                                                <CornerDownRight className="w-4 h-4 text-gray-300 shrink-0" />
                                                <div className="bg-white border border-gray-200 shadow-sm rounded px-3 py-1.5 font-mono text-sm text-gray-800">
                                                    {rule.keywords}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-200">
                                                        {rule.matchType === 'contains' ? 'Contains' :
                                                            rule.matchType === 'exact' ? 'Exact' : 'Regex'}
                                                    </span>
                                                    {rule.priority > 0 && (
                                                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100" title="Higher priority rules run first">
                                                            P{rule.priority}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEditModal(rule)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                                                    title="Edit rule"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(rule.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-md transition-colors"
                                                    title="Delete rule"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }
                            })}
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="border-t border-gray-100 rounded-b-xl overflow-hidden">
                            <Pagination
                                currentPage={currentPage}
                                totalCount={flattenedView.length}
                                pageSize={itemsPerPage}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Modal
                isOpen={!!editModal}
                onClose={() => setEditModal(null)}
                title={editModal?.id ? 'Edit Rule' : 'Create Rule'}
                size="sm"
            >
                <div className="space-y-4">
                    <Input
                        label="Keyword"
                        value={formData.keywords}
                        onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                        placeholder="e.g., uber, netflix, salary"
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Target Category
                        </label>
                        <CategoryTreeSelector
                            categories={categories}
                            value={formData.categoryId}
                            onChange={(id) => setFormData({ ...formData, categoryId: id })}
                            allowParentSelection={false}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Match Type"
                            value={formData.matchType}
                            onChange={(e) => setFormData({ ...formData, matchType: e.target.value })}
                            options={[
                                { value: 'contains', label: 'Contains keyword' },
                                { value: 'exact', label: 'Exact match' },
                            ]}
                        />

                        <Input
                            label="Priority"
                            type="number"
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                            placeholder="0"
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Rules with higher priority run first. Useful for overlapping keywords.</p>

                    <div className="flex gap-2 justify-end pt-4 border-t mt-6">
                        <Button variant="secondary" onClick={() => setEditModal(null)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving || !formData.keywords.trim() || !formData.categoryId}
                        >
                            {isSaving ? 'Saving...' : 'Save Rule'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
