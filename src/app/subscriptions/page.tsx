'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import {
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  Landmark,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Repeat2,
  ScanSearch,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Loader,
  Modal,
  Select,
  useToast,
} from '@/components/ui';
import type { BillingCycle } from '@/generated/prisma';

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
  createdAt: string;
  updatedAt: string;
  source: string;
  matchPattern: string | null;
  lastSeenDate: string | null;
  firstSeenDate: string | null;
  occurrences: number;
  avgAmount: number | null;
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

interface SubscriptionFormValues {
  name: string;
  logo: string;
  price: number;
  currency: string;
  billingCycle: BillingCycle;
  frequency: number;
  nextPayment: string;
  autoRenew: boolean;
  inactive: boolean;
  url: string;
  notes: string;
  categoryId: string;
  accountId: string;
}

const billingCycleOptions = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

const currencyOptions = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'BRL', label: 'BRL' },
  { value: 'CAD', label: 'CAD' },
  { value: 'AUD', label: 'AUD' },
];

function formatBillingCycle(cycle: BillingCycle, frequency: number) {
  const cycleNames: Record<BillingCycle, string> = {
    DAILY: frequency === 1 ? 'Daily' : `Every ${frequency} days`,
    WEEKLY: frequency === 1 ? 'Weekly' : `Every ${frequency} weeks`,
    MONTHLY: frequency === 1 ? 'Monthly' : `Every ${frequency} months`,
    YEARLY: frequency === 1 ? 'Yearly' : `Every ${frequency} years`,
  };

  return cycleNames[cycle];
}

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: date.getUTCFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

function getDaysUntilPayment(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const utcNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((utcDate - utcNow) / (1000 * 60 * 60 * 24));
}

function getDueMeta(dateString: string) {
  const daysUntil = getDaysUntilPayment(dateString);

  if (daysUntil < 0) {
    return {
      label: `${Math.abs(daysUntil)} days overdue`,
      dateLabel: `Was due ${formatDate(dateString)}`,
      accent: 'bg-red-500',
      badge: 'bg-red-50 text-red-700 ring-red-200',
      text: 'text-red-600',
    };
  }

  if (daysUntil === 0) {
    return {
      label: 'Due today',
      dateLabel: formatDate(dateString),
      accent: 'bg-amber-500',
      badge: 'bg-amber-50 text-amber-700 ring-amber-200',
      text: 'text-amber-600',
    };
  }

  if (daysUntil <= 7) {
    return {
      label: daysUntil === 1 ? 'Due tomorrow' : `Due in ${daysUntil} days`,
      dateLabel: formatDate(dateString),
      accent: 'bg-amber-500',
      badge: 'bg-amber-50 text-amber-700 ring-amber-200',
      text: 'text-amber-600',
    };
  }

  return {
    label: `Due ${formatDate(dateString)}`,
    dateLabel: formatDate(dateString),
    accent: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 ring-blue-200',
    text: 'text-gray-500',
  };
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [filterInactive, setFilterInactive] = useState('all');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [sortBy, setSortBy] = useState('nextPayment');
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('stats', 'true');
      params.set('sort', sortBy);
      if (filterInactive !== 'all') params.set('inactive', filterInactive);
      if (filterCategory) params.set('categoryId', filterCategory);
      if (filterSource) params.set('source', filterSource);

      const subsRes = await fetch(`/api/subscriptions?${params.toString()}`);
      const subsData = await subsRes.json();
      setSubscriptions(subsData.subscriptions || []);
      setStats(subsData.stats);

      const catRes = await fetch('/api/categories');
      const catData = await catRes.json();
      setCategories(catData.categories || catData || []);

      const accRes = await fetch('/api/accounts');
      const accData = await accRes.json();
      setAccounts(Array.isArray(accData) ? accData : []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load subscriptions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [filterCategory, filterInactive, filterSource, sortBy, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleScanTransactions = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/subscriptions/detect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to scan');
      toast.success(`Scan complete: ${data.created} new, ${data.updated} updated, ${data.markedInactive} deactivated`);
      fetchData();
    } catch (error) {
      console.error('Scan failed:', error);
      toast.error('Failed to scan transactions for subscriptions');
    } finally {
      setIsScanning(false);
    }
  };

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
      const nextDate = new Date(subscription.nextPayment);
      switch (subscription.billingCycle) {
        case 'DAILY':
          nextDate.setUTCDate(nextDate.getUTCDate() + subscription.frequency);
          break;
        case 'WEEKLY':
          nextDate.setUTCDate(nextDate.getUTCDate() + 7 * subscription.frequency);
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
      toast.success('Marked as paid. Next payment date updated.');
      fetchData();
    } catch (error) {
      console.error('Failed to mark as paid:', error);
      toast.error('Failed to update subscription');
    }
  };

  const handleSubmit = async (formData: SubscriptionFormValues) => {
    const payload = {
      ...formData,
      categoryId: formData.categoryId || null,
      accountId: formData.accountId || null,
    };

    try {
      const res = editingSubscription
        ? await fetch(`/api/subscriptions/${editingSubscription.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
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

  const hasCustomFilters = filterInactive !== 'all' || Boolean(filterCategory) || Boolean(filterSource) || sortBy !== 'nextPayment';

  const renderSubscriptionCard = (subscription: Subscription) => {
    const dueMeta = getDueMeta(subscription.nextPayment);
    const accent = subscription.inactive ? 'bg-gray-300' : dueMeta.accent;

    return (
      <div key={subscription.id} className="p-4 md:p-5">
        <div className="flex gap-4">
          <div className={`hidden w-1 shrink-0 rounded-full md:block ${accent}`} />
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                {subscription.logo ? (
                  <Image src={subscription.logo} alt={subscription.name} width={56} height={56} className="h-14 w-14 rounded-xl border border-gray-200 object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-lg font-semibold text-gray-500">
                    {subscription.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={`text-lg font-semibold ${subscription.inactive ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{subscription.name}</h3>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${subscription.inactive ? 'bg-gray-100 text-gray-600 ring-gray-200' : dueMeta.badge}`}>
                      {subscription.inactive ? 'Inactive' : dueMeta.label}
                    </span>
                    {subscription.source === 'detected' && (
                      <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-200">
                        <Sparkles className="mr-1 h-3 w-3" />
                        Auto-detected
                      </span>
                    )}
                    {!subscription.autoRenew && (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                        Manual renewal
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                      <Repeat2 className="h-3.5 w-3.5" />
                      {formatBillingCycle(subscription.billingCycle, subscription.frequency)}
                    </span>
                    {subscription.category && (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: `${subscription.category.color}18`, color: subscription.category.color }}>
                        <FolderOpen className="h-3.5 w-3.5" />
                        {subscription.category.name}
                      </span>
                    )}
                    {subscription.account && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                        <Landmark className="h-3.5 w-3.5" />
                        {subscription.account.name}
                      </span>
                    )}
                  </div>

                  {subscription.source === 'detected' && subscription.occurrences > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-600">
                        {subscription.occurrences} occurrences
                      </span>
                      {subscription.firstSeenDate && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                          Since {formatDate(subscription.firstSeenDate)}
                        </span>
                      )}
                      {subscription.lastSeenDate && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                          Last seen {formatDate(subscription.lastSeenDate)}
                        </span>
                      )}
                    </div>
                  )}

                  {subscription.notes && <p className="max-w-2xl text-sm leading-6 text-gray-600">{subscription.notes}</p>}

                  {subscription.url && (
                    <a
                      href={subscription.url.startsWith('http') ? subscription.url : `https://${subscription.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Visit website
                    </a>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4 xl:items-end">
                <div className="space-y-1 text-left xl:text-right">
                  <p className="text-2xl font-semibold text-gray-900">{formatCurrency(subscription.price, subscription.currency)}</p>
                  <p className={`text-sm font-medium ${subscription.inactive ? 'text-gray-500' : dueMeta.text}`}>
                    {subscription.inactive ? `Next payment ${formatDate(subscription.nextPayment)}` : dueMeta.label}
                  </p>
                  <p className="text-sm text-gray-500">{subscription.inactive ? formatDate(subscription.nextPayment) : dueMeta.dateLabel}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => handleMarkAsPaid(subscription)} disabled={subscription.inactive} className="gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Paid
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleToggleInactive(subscription)} className="gap-1.5">
                    {subscription.inactive ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                    {subscription.inactive ? 'Activate' : 'Pause'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleEditSubscription(subscription)} className="gap-1.5">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteSubscription(subscription.id)} className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 focus:ring-red-500">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader size={80} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="mt-1 text-gray-500">Track recurring payments, renewals, and paused services.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleScanTransactions} disabled={isScanning}>
            <ScanSearch className="mr-2 h-5 w-5" />
            {isScanning ? 'Scanning...' : 'Scan Transactions'}
          </Button>
          <Button onClick={handleAddSubscription}>
            <Plus className="mr-2 h-5 w-5" />
            Add Subscription
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="space-y-2"><p className="text-sm text-gray-500">Active subscriptions</p><p className="text-2xl font-bold text-gray-900">{stats.activeSubscriptions}</p><p className="text-xs text-gray-500">{stats.inactiveSubscriptions} inactive</p></CardContent></Card>
          <Card><CardContent className="space-y-2"><p className="text-sm text-gray-500">Monthly spend</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalMonthlyCost)}</p><p className="text-xs text-gray-500">Estimated recurring monthly cost</p></CardContent></Card>
          <Card><CardContent className="space-y-2"><p className="text-sm text-gray-500">Yearly projection</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalYearlyCost)}</p><p className="text-xs text-gray-500">Based on current active subscriptions</p></CardContent></Card>
          <Card><CardContent className="space-y-2"><p className="text-sm text-gray-500">Paused savings</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalSavings)}</p><p className="text-xs text-gray-500">Potential savings from inactive services</p></CardContent></Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden border-orange-100 bg-gradient-to-r from-orange-50 via-white to-rose-50">
          <CardContent className="space-y-4 p-5">
            <p className="text-sm font-medium text-orange-700">Subscription spotlight</p>
            {stats?.mostExpensive ? (
              <>
                <h2 className="text-2xl font-semibold text-gray-900">{stats.mostExpensive.name}</h2>
                <p className="text-sm text-gray-600">
                  Highest monthly commitment at <span className="font-semibold text-gray-900">{formatCurrency(stats.mostExpensive.monthlyPrice)}</span> per month.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-semibold text-gray-900">No subscriptions yet</h2>
                <p className="text-sm text-gray-600">Create your first subscription to start tracking renewals.</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Filters" subtitle="Refine the list by status, category, or sort order." />
          <CardContent className="space-y-4">
            <Select
              label="Status"
              value={filterInactive}
              onChange={(event) => setFilterInactive(event.target.value)}
              options={[
                { value: 'all', label: 'All subscriptions' },
                { value: 'false', label: 'Active only' },
                { value: 'true', label: 'Inactive only' },
              ]}
            />
            <Select
              label="Category"
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
              options={[{ value: '', label: 'All categories' }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
            />
            <Select
              label="Source"
              value={filterSource}
              onChange={(event) => setFilterSource(event.target.value)}
              options={[
                { value: '', label: 'All sources' },
                { value: 'manual', label: 'Manual only' },
                { value: 'detected', label: 'Auto-detected only' },
              ]}
            />
            <Select
              label="Sort by"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              options={[
                { value: 'nextPayment', label: 'Next payment' },
                { value: 'price', label: 'Price (high to low)' },
                { value: 'name', label: 'Name' },
              ]}
            />
            {hasCustomFilters && (
              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => { setFilterInactive('all'); setFilterCategory(''); setFilterSource(''); setSortBy('nextPayment'); }}>
                  Reset view
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Subscriptions"
          subtitle={stats ? `${subscriptions.length} shown, ${stats.activeSubscriptions} active, ${stats.inactiveSubscriptions} inactive` : `${subscriptions.length} shown`}
        />
        <CardContent className="p-0">
          {subscriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="rounded-full bg-gray-100 p-4">
                <Repeat2 className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">No subscriptions found</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">Add your first subscription, scan your transactions, or adjust the filters.</p>
              <div className="mt-6 flex gap-3">
                <Button variant="outline" onClick={handleScanTransactions} disabled={isScanning}>
                  <ScanSearch className="mr-2 h-4 w-4" />
                  {isScanning ? 'Scanning...' : 'Scan Transactions'}
                </Button>
                <Button onClick={handleAddSubscription}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Subscription
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {(() => {
                const activeSubscriptions = subscriptions.filter(s => !s.inactive);
                const inactiveSubscriptions = subscriptions.filter(s => s.inactive);

                return (
                  <>
                    {activeSubscriptions.length > 0 && (
                      <>
                        <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-2.5">
                          <h3 className="text-sm font-semibold text-gray-700">Active ({activeSubscriptions.length})</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {activeSubscriptions.map(renderSubscriptionCard)}
                        </div>
                      </>
                    )}
                    {inactiveSubscriptions.length > 0 && (
                      <>
                        <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-2.5">
                          <h3 className="text-sm font-semibold text-gray-500">Inactive ({inactiveSubscriptions.length})</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {inactiveSubscriptions.map(renderSubscriptionCard)}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingSubscription ? 'Edit Subscription' : 'Add Subscription'} size="lg">
        <SubscriptionForm subscription={editingSubscription} categories={categories} accounts={accounts} onSubmit={handleSubmit} onCancel={() => setIsFormOpen(false)} />
      </Modal>
    </div>
  );
}

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
  onSubmit: (data: SubscriptionFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<SubscriptionFormValues>({
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Name *" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} required />
        <Input label="Logo URL" type="url" value={formData.logo} onChange={(event) => setFormData({ ...formData, logo: event.target.value })} placeholder="https://example.com/logo.png" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Input label="Price *" type="number" step="0.01" min="0" value={formData.price} onChange={(event) => setFormData({ ...formData, price: Number.parseFloat(event.target.value) || 0 })} required />
        <Select label="Currency" value={formData.currency} onChange={(event) => setFormData({ ...formData, currency: event.target.value })} options={currencyOptions} />
        <Input label="Next Payment Date *" type="date" value={formData.nextPayment} onChange={(event) => setFormData({ ...formData, nextPayment: event.target.value })} required />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select label="Billing Cycle" value={formData.billingCycle} onChange={(event) => setFormData({ ...formData, billingCycle: event.target.value as BillingCycle })} options={billingCycleOptions} />
        <Input label="Frequency" type="number" min="1" max="366" value={formData.frequency} onChange={(event) => setFormData({ ...formData, frequency: Number.parseInt(event.target.value, 10) || 1 })} helperText="Use 1 for every cycle, 2 for every other cycle, and so on." />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select label="Category" value={formData.categoryId} onChange={(event) => setFormData({ ...formData, categoryId: event.target.value })} options={[{ value: '', label: 'No category' }, ...categories.map((category) => ({ value: category.id, label: category.name }))]} />
        <Select label="Payment Account" value={formData.accountId} onChange={(event) => setFormData({ ...formData, accountId: event.target.value })} options={[{ value: '', label: 'No account' }, ...accounts.map((account) => ({ value: account.id, label: account.name }))]} />
      </div>

      <Input label="Website URL" value={formData.url} onChange={(event) => setFormData({ ...formData, url: event.target.value })} placeholder="example.com" />

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Optional context about the subscription or billing details"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-medium text-gray-900">Subscription Behavior</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:gap-6">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={formData.autoRenew} onChange={(event) => setFormData({ ...formData, autoRenew: event.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            Auto-renew enabled
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={formData.inactive} onChange={(event) => setFormData({ ...formData, inactive: event.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            Mark as inactive
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onCancel} type="button">Cancel</Button>
        <Button type="submit" isLoading={isSubmitting}>{subscription ? 'Update Subscription' : 'Create Subscription'}</Button>
      </div>
    </form>
  );
}
