'use client';

import { useEffect, useState, useCallback } from 'react';
import { CreditCard, ChevronRight, CalendarDays, Plus } from 'lucide-react';
import { Account, CreditCardInvoice, CreditCardSummary, InvoiceStatus } from '@/types';
import { Badge, Button, Loader, Modal, useToast } from '@/components/ui';
import { AccountForm, AccountFormData } from '@/components/accounts';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatRef(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1] ?? '?'} ${year}`;
}

function formatDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

const STATUS_VARIANT: Record<InvoiceStatus, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  OPEN: 'warning',
  CLOSED: 'secondary',
  PAID: 'success',
  PARTIAL: 'default',
};

interface InvoiceWithCount extends CreditCardInvoice {
  _count?: { transactions: number };
}

interface CardDetail {
  account: Account & { invoices: InvoiceWithCount[] };
  availableLimit: number | null;
}

interface InvoiceTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  installmentNumber: number | null;
  installmentTotal: number | null;
  category: { id: string; name: string; color: string } | null;
}

interface InvoiceDetail extends CreditCardInvoice {
  account: { id: string; name: string };
  transactions: InvoiceTransaction[];
}

export default function CreditCardsPage() {
  const [cards, setCards] = useState<Account[]>([]);
  const [summaries, setSummaries] = useState<Record<string, CreditCardSummary>>({});
  const [details, setDetails] = useState<Record<string, CardDetail>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openInvoice, setOpenInvoice] = useState<InvoiceDetail | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { hideSensitiveValues } = useSensitiveValues();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [accountsRes, summariesRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/credit-cards'),
      ]);
      const accounts: Account[] = await accountsRes.json();
      setCards(accounts.filter((a) => a.type === 'CREDIT_CARD'));

      if (summariesRes.ok) {
        const data: CreditCardSummary[] = await summariesRes.json();
        setSummaries(Object.fromEntries(data.map((s) => [s.accountId, s])));
      }
    } catch (error) {
      console.error('Failed to load credit cards:', error);
      toast.error('Failed to load credit cards.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadDetail = useCallback(async (accountId: string) => {
    try {
      const res = await fetch(`/api/credit-cards/${accountId}`);
      if (!res.ok) throw new Error('failed');
      const data: CardDetail = await res.json();
      setDetails((prev) => ({ ...prev, [accountId]: data }));
    } catch {
      toast.error('Failed to load invoices.');
    }
  }, [toast]);

  const toggleExpand = (accountId: string) => {
    if (expanded === accountId) {
      setExpanded(null);
      return;
    }
    setExpanded(accountId);
    if (!details[accountId]) loadDetail(accountId);
  };

  const handleCreateCard = async (data: AccountFormData) => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create card');
      }
      toast.success('Card added successfully');
      setIsFormOpen(false);
      await fetchData();
    } catch (error) {
      console.error('Failed to create card:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create card');
    }
  };

  const openInvoiceDetail = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/credit-cards/invoices/${invoiceId}`);
      if (!res.ok) throw new Error('failed');
      const data: InvoiceDetail = await res.json();
      setOpenInvoice(data);
    } catch {
      toast.error('Failed to load invoice.');
    }
  };

  const updateStatus = async (invoiceId: string, status: InvoiceStatus, paidAmount?: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/credit-cards/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(paidAmount !== undefined ? { paidAmount } : {}) }),
      });
      if (!res.ok) throw new Error('failed');
      toast.success(status === 'PAID' ? 'Marked as paid' : 'Invoice updated');
      setOpenInvoice(null);
      // Refresh the affected card's detail and summaries.
      if (expanded) await loadDetail(expanded);
      await fetchData();
    } catch {
      toast.error('Failed to update invoice.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] w-full">
        <Loader size={80} />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Credit Cards</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Invoices, limits and installments</p>
          </div>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Card
          </Button>
        </div>
        <div className="text-center py-12 bg-card rounded-lg shadow">
          <CreditCard className="mx-auto h-12 w-12 text-muted-foreground/70" />
          <h3 className="mt-2 text-sm font-medium text-foreground">No credit cards</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a credit-card account, then upload a fatura to auto-fill its limit and invoices.
          </p>
        </div>

        <AccountForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleCreateCard}
          defaultType="CREDIT_CARD"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Credit Cards</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Invoices, limits and installments</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4" />
          New Card
        </Button>
      </div>

      <div className="space-y-3">
        {cards.map((card) => {
          const summary = summaries[card.id];
          const limit = summary?.creditLimit ?? card.creditLimit ?? null;
          const available = summary?.availableLimit ?? null;
          const used = limit != null && available != null ? Math.max(0, limit - available) : null;
          const usedPct = limit && used != null ? Math.min(100, Math.round((used / limit) * 100)) : null;
          const current = summary?.currentInvoice ?? null;
          const dueLabel = formatDate(current?.dueDate ?? null);
          const detail = details[card.id];
          const isOpen = expanded === card.id;

          return (
            <div key={card.id} className="bg-card rounded-lg shadow border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => toggleExpand(card.id)}
                className="w-full text-left p-4 flex items-center gap-4 hover:bg-accent/50 transition-colors"
              >
                <div
                  className="w-11 h-11 shrink-0 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${card.color}20` }}
                >
                  <CreditCard className="w-6 h-6" style={{ color: card.color }} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate text-foreground">{card.name}</h3>
                    {card.lastFour && (
                      <span className="text-xs text-muted-foreground">•••• {card.lastFour}</span>
                    )}
                  </div>
                  {limit != null && (
                    <div className="mt-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>
                          {usedPct != null ? `${usedPct}% used` : 'Limit'}
                          {used != null && (
                            <span className="ml-1">
                              · {formatCurrency(used, { hideSensitiveValues })} of {formatCurrency(limit, { hideSensitiveValues })}
                            </span>
                          )}
                        </span>
                        {dueLabel && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            Due {dueLabel}
                          </span>
                        )}
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            usedPct != null && usedPct >= 90 ? 'bg-red-500' : usedPct != null && usedPct >= 70 ? 'bg-amber-500' : 'bg-primary'
                          }`}
                          style={{ width: `${usedPct ?? 0}%` }}
                        />
                      </div>
                      {available != null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(available, { hideSensitiveValues })} available
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <ChevronRight
                  className={`w-5 h-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="border-t border-border">
                  {!detail ? (
                    <div className="p-6 flex justify-center">
                      <Loader size={40} />
                    </div>
                  ) : detail.account.invoices.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No invoices yet. Upload a fatura (PDF) for this card to create one.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {detail.account.invoices.map((inv) => (
                        <li key={inv.id}>
                          <button
                            type="button"
                            onClick={() => openInvoiceDetail(inv.id)}
                            className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-accent/50 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">
                                  {formatRef(inv.referenceMonth, inv.referenceYear)}
                                </span>
                                <Badge variant={STATUS_VARIANT[inv.status]}>{inv.status}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {inv._count?.transactions ?? 0} transactions
                                {formatDate(inv.dueDate) && <> · Due {formatDate(inv.dueDate)}</>}
                              </p>
                            </div>
                            <span className="font-semibold text-foreground whitespace-nowrap">
                              {inv.totalAmount != null
                                ? formatCurrency(inv.totalAmount, { hideSensitiveValues })
                                : '—'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={!!openInvoice}
        onClose={() => setOpenInvoice(null)}
        title={openInvoice ? `${openInvoice.account.name} · ${formatRef(openInvoice.referenceMonth, openInvoice.referenceYear)}` : ''}
        size="lg"
      >
        {openInvoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-semibold text-foreground">
                  {openInvoice.totalAmount != null ? formatCurrency(openInvoice.totalAmount, { hideSensitiveValues }) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Minimum</p>
                <p className="font-semibold text-foreground">
                  {openInvoice.minimumPayment != null ? formatCurrency(openInvoice.minimumPayment, { hideSensitiveValues }) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Due</p>
                <p className="font-semibold text-foreground">{formatDate(openInvoice.dueDate) ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={STATUS_VARIANT[openInvoice.status]}>{openInvoice.status}</Badge>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
              <ul className="divide-y divide-border">
                {openInvoice.transactions.map((t) => (
                  <li key={t.id} className="px-3 py-2 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(t.date)}
                        {t.installmentNumber && t.installmentTotal && (
                          <span className="ml-1">· {t.installmentNumber}/{t.installmentTotal}</span>
                        )}
                        {t.category && <span className="ml-1">· {t.category.name}</span>}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-foreground whitespace-nowrap">
                      {formatCurrency(t.amount, { hideSensitiveValues })}
                    </span>
                  </li>
                ))}
                {openInvoice.transactions.length === 0 && (
                  <li className="px-3 py-4 text-sm text-muted-foreground text-center">No transactions linked.</li>
                )}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2 justify-end pt-2">
              {openInvoice.status !== 'OPEN' && (
                <Button variant="ghost" disabled={saving} onClick={() => updateStatus(openInvoice.id, 'OPEN')}>
                  Reopen
                </Button>
              )}
              {openInvoice.status !== 'PAID' && (
                <Button
                  disabled={saving}
                  onClick={() => updateStatus(openInvoice.id, 'PAID', openInvoice.totalAmount ?? undefined)}
                >
                  Mark as paid
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <AccountForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreateCard}
        defaultType="CREDIT_CARD"
      />
    </div>
  );
}
