'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, Modal, Input, Button, Select } from '@/components/ui';

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
    };
}

interface Category {
    id: string;
    name: string;
    color: string;
}

export function CategoryRules() {
    const [rules, setRules] = useState<CategorizationRule[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editModal, setEditModal] = useState<CategorizationRule | null>(null);
    const [isSaving, setIsSaving] = useState(false);
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

    const handleSave = async () => {
        if (!formData.keywords.trim() || !formData.categoryId) return;

        setIsSaving(true);
        try {
            const url = editModal?.id ? `/api/categorization-rules?id=${editModal.id}` : '/api/categorization-rules';
            const method = editModal?.id ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
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
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <>
            <Card>
                <CardHeader
                    title="Categorization Rules"
                    subtitle="Rules for automatic transaction categorization"
                    action={
                        <Button size="sm" onClick={() => openEditModal()}>
                            <Plus className="w-4 h-4 mr-1" />
                            Add Rule
                        </Button>
                    }
                />
                <CardContent className="p-0">
                    {rules.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <p>No categorization rules yet.</p>
                            <p className="text-sm mt-1">Rules help automatically categorize transactions based on keywords.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {rules.map((rule) => (
                                <div key={rule.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: `${rule.category.color}20` }}
                                        >
                                            <Tag className="w-4 h-4" style={{ color: rule.category.color }} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{rule.keywords}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span
                                                    className="px-2 py-0.5 text-xs rounded-full"
                                                    style={{
                                                        backgroundColor: `${rule.category.color}20`,
                                                        color: rule.category.color,
                                                    }}
                                                >
                                                    {rule.category.name}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {rule.matchType === 'contains' ? 'Contains' :
                                                        rule.matchType === 'exact' ? 'Exact match' : 'Regex'}
                                                </span>
                                                {rule.priority > 0 && (
                                                    <span className="text-xs text-gray-400">
                                                        Priority: {rule.priority}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openEditModal(rule)}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                            title="Edit rule"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(rule.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                            title="Delete rule"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit/Create Modal */}
            <Modal
                isOpen={!!editModal}
                onClose={() => setEditModal(null)}
                title={editModal?.id ? 'Edit Rule' : 'Create Rule'}
                size="md"
            >
                <div className="space-y-4">
                    <Input
                        label="Keyword"
                        value={formData.keywords}
                        onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                        placeholder="e.g., uber, netflix, salary"
                    />

                    <Select
                        label="Category"
                        value={formData.categoryId}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                        options={[
                            { value: '', label: 'Select a category' },
                            ...categories.map((c) => ({ value: c.id, label: c.name })),
                        ]}
                    />

                    <Select
                        label="Match Type"
                        value={formData.matchType}
                        onChange={(e) => setFormData({ ...formData, matchType: e.target.value })}
                        options={[
                            { value: 'contains', label: 'Contains' },
                            { value: 'exact', label: 'Exact Match' },
                            { value: 'regex', label: 'Regular Expression' },
                        ]}
                    />

                    <Input
                        label="Priority (higher = more important)"
                        type="number"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                    />

                    <div className="flex gap-2 justify-end pt-4 border-t">
                        <Button variant="secondary" onClick={() => setEditModal(null)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving || !formData.keywords.trim() || !formData.categoryId}
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
