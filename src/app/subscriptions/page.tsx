'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useToast, Loader, Modal, Button } from '@/components/ui';
import { BillingCycle } from '@/generated/prisma';

// Types
interface Subscription {
    id: string;
    name: string;
    logo: string | null;
    price: number;
    currency: string;
    billingCycle: BillingCycle;
    frequency: number;
    nextPayment: string;
    autoRenew: boolean;
    inactive: boolean;
    url: string | null;
    notes: string | null;
    categoryId: string | null;
    accountId: string | null;
    replacementId: string | null;
    createdAt: string;
    updatedAt: string;
    category?: { id: string; name: string; color: string } | null;
    account?: { id: string; name: string; type: string } | null;
}

interface SubscriptionStats {
    activeSubscriptions: number;
    inactiveSubscriptions: number;
    totalMonthlyCost: number;
    totalYearlyCost: number;
    mostExpensive: { name: string; monthlyPrice: number } | null;
    totalSavings: number;
}

interface Category {
    id: string;
    name: string;
    color: string;
}

interface Account {
    id: string;
    name: string;
    type: string;
}

// Helper to format billing cycle
function formatBillingCycle(cycle: BillingCycle, frequency: number): string {
    const cycleNames: Record<BillingCycle, string> = {
        DAILY: frequency === 1 ? 'Daily' : `Every ${frequency} days`,
        WEEKLY: frequency === 1 ? 'Weekly' : `Every ${frequency} weeks`,
        MONTHLY: frequency === 1 ? 'Monthly' : `Every ${frequency} months`,
        YEARLY: frequency === 1 ? 'Yearly' : `Every ${frequency} years`,
    };
    return cycleNames[cycle];
}

// Helper to format currency
function formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
    }).format(amount);
}

// Helper to format date
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const isCurrentYear = date.getUTCFullYear() === now.getFullYear();

    return date.toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
        year: isCurrentYear ? undefined : 'numeric',
    });
}

// Helper to get days until payment
function getDaysUntilPayment(dateString: string): number {
    const date = new Date(dateString);
    const now = new Date();
    const utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const utcNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = utcDate - utcNow;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export default function SubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [stats, setStats] = useState<SubscriptionStats | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
    const [filterInactive, setFilterInactive] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [sortBy, setSortBy] = useState<string>('nextPayment');
    const toast = useToast();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch subscriptions with stats
            const params = new URLSearchParams();
            params.set('stats', 'true');
            params.set('sort', sortBy);
            if (filterInactive !== 'all') {
                params.set('inactive', filterInactive);
            }
            if (filterCategory) {
                params.set('categoryId', filterCategory);
            }

            const subsRes = await fetch(`/api/subscriptions?${params.toString()}`);
            const subsData = await subsRes.json();
            setSubscriptions(subsData.subscriptions || []);
            setStats(subsData.stats);

            // Fetch categories
            const catRes = await fetch('/api/categories');
            const catData = await catRes.json();
            setCategories(catData.categories || catData || []);

            // Fetch accounts
            const accRes = await fetch('/api/accounts');
            const accData = await accRes.json();
            setAccounts(accData);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Failed to load subscriptions. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [sortBy, filterInactive, filterCategory, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddSubscription = () => {
        setEditingSubscription(null);
        setIsFormOpen(true);
    };

    const handleEditSubscription = (subscription: Subscription) => {
        setEditingSubscription(subscription);
        setIsFormOpen(true);
    };

    const handleDeleteSubscription = async (id: string) => {
        if (!confirm('Are you sure you want to delete this subscription?')) return;

        try {
            const res = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete subscription');
            }
            toast.success('Subscription deleted successfully');
            fetchData();
        } catch (error) {
            console.error('Failed to delete subscription:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to delete subscription');
        }
    };

    const handleToggleInactive = async (subscription: Subscription) => {
        try {
            const res = await fetch(`/api/subscriptions/${subscription.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inactive: !subscription.inactive }),
            });
            if (!res.ok) throw new Error('Failed to update subscription');
            toast.success(subscription.inactive ? 'Subscription activated' : 'Subscription deactivated');
            fetchData();
        } catch (error) {
            console.error('Failed to toggle subscription:', error);
            toast.error('Failed to update subscription');
        }
    };

    const handleMarkAsPaid = async (subscription: Subscription) => {
        try {
            // Calculate next payment date
            const currentNextPayment = new Date(subscription.nextPayment);
            const nextDate = new Date(currentNextPayment);

            switch (subscription.billingCycle) {
                case 'DAILY':
                    nextDate.setUTCDate(nextDate.getUTCDate() + subscription.frequency);
                    break;
                case 'WEEKLY':
                    nextDate.setUTCDate(nextDate.getUTCDate() + (7 * subscription.frequency));
                    break;
                case 'MONTHLY':
                    nextDate.setUTCMonth(nextDate.getUTCMonth() + subscription.frequency);
                    break;
                case 'YEARLY':
                    nextDate.setUTCFullYear(nextDate.getUTCFullYear() + subscription.frequency);
                    break;
            }

            const res = await fetch(`/api/subscriptions/${subscription.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nextPayment: nextDate.toISOString().split('T')[0] }),
            });

            if (!res.ok) throw new Error('Failed to update subscription');
            
            toast.success('Marked as paid! Next payment date updated.');
            fetchData();
        } catch (error) {
            console.error('Failed to mark as paid:', error);
            toast.error('Failed to update subscription');
        }
    };

    const handleSubmit = async (formData: Record<string, unknown>) => {
        try {
            const res = editingSubscription
                ? await fetch(`/api/subscriptions/${editingSubscription.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                })
                : await fetch('/api/subscriptions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to save subscription');
            }

            toast.success(editingSubscription ? 'Subscription updated' : 'Subscription created');
            setIsFormOpen(false);
            fetchData();
        } catch (error) {
            console.error('Failed to save subscription:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save subscription');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader size={80} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscriptions</h1>
                    <p className="text-gray-600 dark:text-gray-400">Track your recurring payments and subscriptions</p>
                </div>
                <Button onClick={handleAddSubscription}>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Subscription
                </Button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.activeSubscriptions}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Cost</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(stats.totalMonthlyCost)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Yearly Cost</p>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(stats.totalYearlyCost)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Savings (Inactive)</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.totalSavings)}</p>
                        <p className="text-xs text-gray-500">{stats.inactiveSubscriptions} inactive</p>
                    </div>
                </div>
            )}

            {/* Most Expensive */}
            {stats?.mostExpensive && (
                <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                    <p className="text-sm text-orange-800 dark:text-orange-300">💰 Most Expensive</p>
                    <p className="text-lg font-semibold text-orange-900 dark:text-orange-200">
                        {stats.mostExpensive.name} — {formatCurrency(stats.mostExpensive.monthlyPrice)}/month
                    </p>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-4 bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">Status:</label>
                    <select
                        value={filterInactive}
                        onChange={(e) => setFilterInactive(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"
                    >
                        <option value="all">All</option>
                        <option value="false">Active Only</option>
                        <option value="true">Inactive Only</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">Category:</label>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"
                    >
                        <option value="">All Categories</option>
                        {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">Sort by:</label>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"
                    >
                        <option value="nextPayment">Next Payment</option>
                        <option value="price">Price (High to Low)</option>
                        <option value="name">Name</option>
                    </select>
                </div>
            </div>

            {/* Subscriptions List */}
            {subscriptions.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No subscriptions</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by adding your first subscription.</p>
                    <div className="mt-6">
                        <Button onClick={handleAddSubscription}>Add Subscription</Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {subscriptions.map((subscription) => {
                        const daysUntil = getDaysUntilPayment(subscription.nextPayment);
                        const isOverdue = daysUntil < 0;
                        const isDueSoon = daysUntil >= 0 && daysUntil <= 7;

                        return (
                            <div
                                key={subscription.id}
                                className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 transition-opacity ${subscription.inactive ? 'opacity-60 border-gray-400' :
                                    isOverdue ? 'border-red-500' :
                                        isDueSoon ? 'border-yellow-500' : 'border-blue-500'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        {/* Logo or placeholder */}
                                        {subscription.logo ? (
                                            <Image
                                                src={subscription.logo}
                                                alt={subscription.name}
                                                width={48}
                                                height={48}
                                                className="w-12 h-12 rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                                <span className="text-xl font-bold text-gray-500 dark:text-gray-400">
                                                    {subscription.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        )}

                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className={`font-semibold ${subscription.inactive ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                                                    {subscription.name}
                                                </h3>
                                                {!subscription.autoRenew && (
                                                    <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
                                                        Manual
                                                    </span>
                                                )}
                                                {subscription.inactive && (
                                                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded">
                                                        Inactive
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                                <span>{formatBillingCycle(subscription.billingCycle, subscription.frequency)}</span>
                                                {subscription.category && (
                                                    <span
                                                        className="px-2 py-0.5 rounded text-xs"
                                                        style={{ backgroundColor: subscription.category.color + '20', color: subscription.category.color }}
                                                    >
                                                        {subscription.category.name}
                                                    </span>
                                                )}
                                                {subscription.account && (
                                                    <span className="text-xs">{subscription.account.name}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        {/* Price */}
                                        <div className="text-right">
                                            <p className="font-bold text-lg text-gray-900 dark:text-white">
                                                {formatCurrency(subscription.price, subscription.currency)}
                                            </p>
                                            <p className={`text-sm ${isOverdue ? 'text-red-600 dark:text-red-400' : isDueSoon ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500'}`}>
                                                {isOverdue ? `${Math.abs(daysUntil)} days overdue` :
                                                    daysUntil === 0 ? 'Due today' :
                                                        daysUntil === 1 ? 'Due tomorrow' :
                                                            formatDate(subscription.nextPayment)}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleMarkAsPaid(subscription)}
                                                className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                title="Mark as Paid"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleToggleInactive(subscription)}
                                                className={`p-2 rounded-lg transition-colors ${subscription.inactive
                                                    ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`}
                                                title={subscription.inactive ? 'Activate' : 'Deactivate'}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    {subscription.inactive ? (
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    ) : (
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                    )}
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleEditSubscription(subscription)}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSubscription(subscription.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Notes */}
                                {subscription.notes && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{subscription.notes}</p>
                                    </div>
                                )}

                                {/* URL */}
                                {subscription.url && (
                                    <a
                                        href={subscription.url.startsWith('http') ? subscription.url : `https://${subscription.url}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        Visit
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editingSubscription ? 'Edit Subscription' : 'Add Subscription'}
            >
                <SubscriptionForm
                    subscription={editingSubscription}
                    categories={categories}
                    accounts={accounts}
                    onSubmit={handleSubmit}
                    onCancel={() => setIsFormOpen(false)}
                />
            </Modal>
        </div>
    );
}

// Subscription Form Component
function SubscriptionForm({
    subscription,
    categories,
    accounts,
    onSubmit,
    onCancel,
}: {
    subscription: Subscription | null;
    categories: Category[];
    accounts: Account[];
    onSubmit: (data: Record<string, unknown>) => void;
    onCancel: () => void;
}) {
    const [formData, setFormData] = useState<Record<string, unknown>>({
        name: subscription?.name || '',
        logo: subscription?.logo || '',
        price: subscription?.price || 0,
        currency: subscription?.currency || 'USD',
        billingCycle: subscription?.billingCycle || 'MONTHLY',
        frequency: subscription?.frequency || 1,
        nextPayment: subscription?.nextPayment ? subscription.nextPayment.slice(0, 10) : new Date().toISOString().slice(0, 10),
        autoRenew: subscription?.autoRenew !== false,
        inactive: subscription?.inactive || false,
        url: subscription?.url || '',
        notes: subscription?.notes || '',
        categoryId: subscription?.categoryId || '',
        accountId: subscription?.accountId || '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSubmit({
                ...formData,
                price: Number(formData.price),
                frequency: Number(formData.frequency),
                categoryId: formData.categoryId || null,
                accountId: formData.accountId || null,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name *
                </label>
                <input
                    type="text"
                    value={formData.name as string}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    required
                />
            </div>

            {/* Logo URL */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Logo URL
                </label>
                <input
                    type="url"
                    value={formData.logo as string}
                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
            </div>

            {/* Price and Currency */}
            <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Price *
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price as number}
                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Currency
                    </label>
                    <select
                        value={formData.currency as string}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="BRL">BRL</option>
                        <option value="CAD">CAD</option>
                        <option value="AUD">AUD</option>
                    </select>
                </div>
            </div>

            {/* Billing Cycle */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Billing Cycle
                    </label>
                    <select
                        value={formData.billingCycle as string}
                        onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    >
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="YEARLY">Yearly</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Every X periods
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="366"
                        value={formData.frequency as number}
                        onChange={(e) => setFormData({ ...formData, frequency: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                </div>
            </div>

            {/* Next Payment */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Next Payment Date *
                </label>
                <input
                    type="date"
                    value={formData.nextPayment as string}
                    onChange={(e) => setFormData({ ...formData, nextPayment: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    required
                />
            </div>

            {/* Category and Account */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Category
                    </label>
                    <select
                        value={formData.categoryId as string}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    >
                        <option value="">No Category</option>
                        {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Payment Account
                    </label>
                    <select
                        value={formData.accountId as string}
                        onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    >
                        <option value="">No Account</option>
                        {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* URL */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Website URL
                </label>
                <input
                    type="text"
                    value={formData.url as string}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="example.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
            </div>

            {/* Notes */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                </label>
                <textarea
                    value={formData.notes as string}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
            </div>

            {/* Checkboxes */}
            <div className="flex gap-6">
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={formData.autoRenew as boolean}
                        onChange={(e) => setFormData({ ...formData, autoRenew: e.target.checked })}
                        className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Auto-renew</span>
                </label>
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={formData.inactive as boolean}
                        onChange={(e) => setFormData({ ...formData, inactive: e.target.checked })}
                        className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Inactive</span>
                </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
                <Button variant="secondary" onClick={onCancel} type="button">
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : subscription ? 'Update' : 'Create'}
                </Button>
            </div>
        </form>
    );
}
