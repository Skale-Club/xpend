'use client';

import { useEffect, useState } from 'react';
import { Building2, PiggyBank, CreditCard, Smartphone, Wallet, CircleDollarSign, Edit, Trash2, GripVertical, CalendarDays } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { Account, CreditCardSummary, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ICONS } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatOpeningDate(month?: number | null, year?: number | null): string | null {
  if (!year) return null;
  if (month && month >= 1 && month <= 12) return `${MONTH_ABBR[month - 1]} ${year}`;
  return String(year);
}

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Building2,
  PiggyBank,
  CreditCard,
  Smartphone,
  Wallet,
  CircleDollarSign,
};

interface AccountListProps {
  accounts: Account[];
  balances: Record<string, number>;
  creditSummaries?: Record<string, CreditCardSummary>;
  onAddAccount: () => void;
  onEditAccount: (account: Account) => void;
  onDeleteAccount: (accountId: string) => void;
  onReorder?: (orderedIds: string[]) => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function AccountList({ accounts, balances, creditSummaries, onAddAccount, onEditAccount, onDeleteAccount, onReorder }: AccountListProps) {
  const [deleteModalOpen, setDeleteModalOpen] = useState<string | null>(null);
  const [items, setItems] = useState<Account[]>(accounts);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const { hideSensitiveValues } = useSensitiveValues();

  // Keep local order in sync when the parent's account list changes.
  useEffect(() => {
    setItems(accounts);
  }, [accounts]);

  const getIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName] || CircleDollarSign;
    return IconComponent;
  };

  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDragOver = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    const newOrder = items.map((a) => a.id);
    const prevOrder = accounts.map((a) => a.id);
    if (newOrder.some((id, i) => id !== prevOrder[i])) {
      onReorder?.(newOrder);
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg shadow">
        <CircleDollarSign className="mx-auto h-12 w-12 text-muted-foreground/70" />
        <h3 className="mt-2 text-sm font-medium text-foreground">No accounts</h3>
        <p className="mt-1 text-sm text-muted-foreground">Get started by adding your first account.</p>
        <div className="mt-6">
          <Button onClick={onAddAccount}>Add Account</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {items.map((account, index) => {
          const IconComponent = getIcon(ACCOUNT_TYPE_ICONS[account.type]);
          const balance = balances[account.id] ?? account.initialBalance;
          const isInactive = !account.isActive;
          const isDragging = dragIndex === index;
          const summary = account.type === 'CREDIT_CARD' ? creditSummaries?.[account.id] : undefined;
          const limit = summary?.creditLimit ?? null;
          const available = summary?.availableLimit ?? null;
          const used = limit != null && available != null ? Math.max(0, limit - available) : null;
          const usedPct = limit && used != null ? Math.min(100, Math.round((used / limit) * 100)) : null;
          const dueLabel = formatDueDate(summary?.currentInvoice?.dueDate ?? null);

          return (
            <div
              key={account.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => { e.preventDefault(); handleDragOver(index); }}
              onDragEnd={handleDragEnd}
              className={`bg-card rounded-lg shadow p-3 sm:p-4 border-l-4 transition-opacity ${
                isInactive ? 'opacity-60 border-border' :
                balance < 0 ? 'border-red-500' :
                'border-primary'
              } ${isDragging ? 'opacity-50 ring-2 ring-primary' : ''}`}
            >
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Drag handle (hidden on mobile — drag-to-reorder needs a pointer) */}
                <button
                  type="button"
                  aria-label="Drag to reorder"
                  title="Drag to reorder"
                  className="hidden sm:block shrink-0 cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
                >
                  <GripVertical className="w-5 h-5" />
                </button>

                {/* Icon */}
                <div
                  className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${account.color}20` }}
                >
                  <IconComponent className="w-6 h-6" style={{ color: account.color }} />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold truncate ${isInactive ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {account.name}
                    </h3>
                    {isInactive && (
                      <span className="shrink-0 px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                    {account.bank && <span className="truncate">{account.bank}</span>}
                    <span className="shrink-0 px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                      {ACCOUNT_TYPE_LABELS[account.type]}
                    </span>
                    {formatOpeningDate(account.openingMonth, account.openingYear) && (
                      <span className="hidden sm:inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title="Opening date">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {formatOpeningDate(account.openingMonth, account.openingYear)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Balance */}
                <div className="text-right shrink-0">
                  <p className={`font-bold text-base sm:text-lg whitespace-nowrap ${balance >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                    {formatCurrency(balance, { hideSensitiveValues })}
                  </p>
                  <p className="hidden sm:block text-sm text-muted-foreground">Current Balance</p>
                </div>

                {/* Actions */}
                <div className="flex items-center shrink-0 sm:gap-2">
                  <button
                    onClick={() => onEditAccount(account)}
                    className="p-1.5 sm:p-2 text-muted-foreground/70 hover:text-primary hover:bg-accent rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setDeleteModalOpen(account.id)}
                    className="p-1.5 sm:p-2 text-muted-foreground/70 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {summary && limit != null && (
                <div className="mt-3 pl-0 sm:pl-[3.75rem]">
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
                      <span className="inline-flex items-center gap-1" title="Invoice due date">
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
          );
        })}
      </div>

      <Modal
        isOpen={!!deleteModalOpen}
        onClose={() => setDeleteModalOpen(null)}
        title="Delete Account"
        size="sm"
      >
        <p className="text-muted-foreground mb-4">
          Are you sure you want to delete this account? All associated transactions will also be deleted.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setDeleteModalOpen(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleteModalOpen) {
                onDeleteAccount(deleteModalOpen);
                setDeleteModalOpen(null);
              }
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
