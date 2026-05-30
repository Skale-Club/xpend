'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, Loader, PeriodRangeFilter } from '@/components/ui';
import { getCategoryIcon } from '@/lib/categoryIcons';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import { readArrayResponse } from '@/lib/http';
import { computeRange, monthsInRange, type RangeId } from '@/lib/dateRange';
import type { Category } from '@/types';

interface CategoryNode extends Category {
    children?: CategoryNode[];
    budget?: number | null;
    spent?: number;
}

function buildTree(data: CategoryNode[]): CategoryNode[] {
    const map = new Map<string, CategoryNode>();
    const roots: CategoryNode[] = [];
    for (const cat of data) map.set(cat.id, { ...cat, children: [] });
    for (const cat of data) {
        const node = map.get(cat.id)!;
        if (cat.parentId && map.has(cat.parentId)) {
            map.get(cat.parentId)!.children!.push(node);
        } else {
            roots.push(node);
        }
    }
    const inheritColors = (nodes: CategoryNode[], parentColor?: string) => {
        for (const node of nodes) {
            if (parentColor) node.color = parentColor;
            if (node.children?.length) inheritColors(node.children, node.color);
        }
    };
    inheritColors(roots);
    return roots;
}

export function BudgetsPanel() {
    const { hideSensitiveValues } = useSensitiveValues();
    const [categories, setCategories] = useState<CategoryNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [rangeId, setRangeId] = useState<RangeId>('thisMonth');
    const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [savingId, setSavingId] = useState<string | null>(null);

    const range = useMemo(
        () => (rangeId === 'custom' ? customRange : computeRange(rangeId)),
        [rangeId, customRange]
    );
    const months = useMemo(() => monthsInRange(range.from, range.to), [range]);

    const fetchCategories = useCallback(async () => {
        try {
            const params = new URLSearchParams({ withSpending: '1', type: 'EXPENSE' });
            if (range.from) params.set('dateFrom', range.from.toISOString());
            if (range.to) params.set('dateTo', range.to.toISOString());
            const res = await fetch(`/api/categories?${params.toString()}`);
            const data = await readArrayResponse<CategoryNode>(res, 'Categories');
            setCategories(buildTree(data));
        } catch (error) {
            console.error('Failed to fetch budgets:', error);
            setCategories([]);
        } finally {
            setIsLoading(false);
        }
    }, [range]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const toggleExpand = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const saveBudget = async (id: string, raw: string) => {
        const value = raw.trim() === '' ? null : parseFloat(raw);
        if (value != null && Number.isNaN(value)) return;
        setSavingId(id);
        try {
            const res = await fetch(`/api/categories/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ budget: value }),
            });
            if (res.ok) {
                setDrafts((prev) => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
                await fetchCategories();
            }
        } catch (error) {
            console.error('Failed to save budget:', error);
        } finally {
            setSavingId(null);
        }
    };

    // Roll up totals for the summary card.
    const summary = useMemo(() => {
        let budgeted = 0;
        let spent = 0;
        let overCount = 0;
        const walk = (nodes: CategoryNode[]) => {
            for (const node of nodes) {
                const monthly = node.budget ?? 0;
                const forPeriod = monthly > 0 && months != null ? monthly * months : 0;
                if (forPeriod > 0) {
                    budgeted += forPeriod;
                    spent += node.spent ?? 0;
                    if ((node.spent ?? 0) > forPeriod) overCount += 1;
                }
                if (node.children?.length) walk(node.children);
            }
        };
        walk(categories);
        return { budgeted, spent, overCount };
    }, [categories, months]);

    const renderRow = (category: CategoryNode, level = 0) => {
        const hasChildren = !!category.children?.length;
        const isExpanded = expanded.has(category.id);
        const spent = category.spent ?? 0;
        const monthly = category.budget ?? 0;
        const hasBudget = monthly > 0;
        const budgetForPeriod = hasBudget && months != null ? monthly * months : null;
        const pct = budgetForPeriod && budgetForPeriod > 0 ? (spent / budgetForPeriod) * 100 : null;
        const barColor = pct == null ? '#9CA3AF' : pct <= 75 ? '#22C55E' : pct <= 100 ? '#F59E0B' : '#EF4444';
        const Icon = getCategoryIcon(category.icon || 'Tag');
        const draftValue = drafts[category.id] ?? (monthly ? String(monthly) : '');

        return (
            <div key={category.id}>
                <div
                    className={`py-3 pr-3 hover:bg-muted transition-colors ${level > 0 ? 'border-l-2 border-border' : ''}`}
                    style={{ paddingLeft: `${12 + level * 28}px` }}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            {hasChildren ? (
                                <button onClick={() => toggleExpand(category.id)} className="p-1 hover:bg-muted rounded">
                                    {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    )}
                                </button>
                            ) : (
                                <div className="w-6" />
                            )}
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${category.color}20` }}
                            >
                                <Icon className="w-4 h-4" style={{ color: category.color }} />
                            </div>
                            <div className="min-w-0">
                                <p className="font-medium text-foreground">{category.name}</p>
                                {budgetForPeriod != null ? (
                                    <div className="mt-1.5 w-44 sm:w-56">
                                        <div className="flex items-center justify-between text-[11px] mb-0.5">
                                            <span className="text-muted-foreground">
                                                {formatCurrency(spent, { hideSensitiveValues })} of{' '}
                                                {formatCurrency(budgetForPeriod, { hideSensitiveValues })}
                                            </span>
                                            {pct != null && (
                                                <span className="font-medium" style={{ color: barColor }}>
                                                    {Math.round(pct)}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{ width: `${Math.min(100, pct ?? 0)}%`, backgroundColor: barColor }}
                                            />
                                        </div>
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

                        <div className="flex items-center gap-1.5 shrink-0">
                            <div className="relative">
                                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70" />
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    value={draftValue}
                                    disabled={savingId === category.id}
                                    onChange={(e) =>
                                        setDrafts((prev) => ({ ...prev, [category.id]: e.target.value }))
                                    }
                                    onBlur={(e) => {
                                        const current = monthly ? String(monthly) : '';
                                        if (e.target.value !== current) saveBudget(category.id, e.target.value);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    }}
                                    placeholder="0.00"
                                    className="w-28 pl-7 pr-2 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                                />
                            </div>
                            <span className="text-[11px] text-muted-foreground">/mo</span>
                        </div>
                    </div>
                </div>

                {hasChildren && isExpanded && (
                    <div>{category.children!.map((child) => renderRow(child, level + 1))}</div>
                )}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[40vh] w-full items-center justify-center">
                <Loader size={80} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Budgeted</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                        {formatCurrency(summary.budgeted, { hideSensitiveValues })}
                    </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Spent</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                        {formatCurrency(summary.spent, { hideSensitiveValues })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        of {formatCurrency(summary.budgeted, { hideSensitiveValues })}
                    </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Over budget</p>
                    <p className={`mt-1 text-2xl font-bold ${summary.overCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
                        {summary.overCount}
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader
                    title="Category budgets"
                    subtitle="Set a monthly cap per category and track it against actual spending"
                />
                <CardContent className="p-0">
                    <div className="px-4 py-3 border-b border-border">
                        <PeriodRangeFilter
                            rangeId={rangeId}
                            customRange={customRange}
                            onRangeChange={(id, custom) => {
                                setRangeId(id);
                                setCustomRange(custom);
                            }}
                        />
                    </div>
                    <div className="divide-y divide-gray-100">
                        {categories.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <p>No categories yet. Create categories first to set budgets.</p>
                            </div>
                        ) : (
                            categories.map((category) => renderRow(category))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
