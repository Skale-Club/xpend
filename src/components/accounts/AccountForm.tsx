'use client';

import { useState, useCallback, useMemo } from 'react';
import { Check } from 'lucide-react';
import { Button, Input, Select, Modal, Combobox } from '@/components/ui';
import { Account, AccountType, ACCOUNT_TYPE_LABELS } from '@/types';

interface AccountFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AccountFormData) => void;
  account?: Account | null;
  // Pre-selected type for a brand-new account (e.g. the Credit Cards page opens
  // the form straight into CREDIT_CARD). Ignored when editing an existing account.
  defaultType?: AccountType;
}

export interface AccountFormData {
  name: string;
  type: AccountType;
  bank: string;
  color: string;
  initialBalance: number;
  openingMonth: number | null;
  openingYear: number | null;
  creditLimit: number | null;
  closingDay: number | null;
  dueDay: number | null;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

const MONTH_OPTIONS = [
  { value: '', label: '— None —' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const ACCOUNT_TYPES = Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function getInitialFormData(account?: Account | null, defaultType: AccountType = 'CHECKING'): AccountFormData {
  if (account) {
    return {
      name: account.name,
      type: account.type,
      bank: account.bank || '',
      color: account.color,
      initialBalance: account.initialBalance,
      openingMonth: account.openingMonth ?? null,
      openingYear: account.openingYear ?? null,
      creditLimit: account.creditLimit ?? null,
      closingDay: account.closingDay ?? null,
      dueDay: account.dueDay ?? null,
    };
  }
  return {
    name: '',
    type: defaultType,
    bank: '',
    color: COLORS[0],
    initialBalance: 0,
    openingMonth: null,
    openingYear: null,
    creditLimit: null,
    closingDay: null,
    dueDay: null,
  };
}

export function AccountForm({ isOpen, onClose, onSubmit, account, defaultType }: AccountFormProps) {
  // Memoize initial form data based on account
  const initialData = useMemo(() => getInitialFormData(account, defaultType), [account, defaultType]);
  const [formData, setFormData] = useState<AccountFormData>(initialData);

  // Track previous account id to detect changes
  const [prevAccountId, setPrevAccountId] = useState<string | null | undefined>(account?.id);

  // Sync form when account changes (edit different account)
  if (account?.id !== prevAccountId) {
    setPrevAccountId(account?.id);
    setFormData(getInitialFormData(account, defaultType));
  }

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  }, [formData, onSubmit]);

  const handleClose = useCallback(() => {
    // Reset form to initial state on close
    setFormData(getInitialFormData(null, defaultType));
    setPrevAccountId(null);
    onClose();
  }, [onClose, defaultType]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={account ? 'Edit Account' : 'Add New Account'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Account Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Main Checking"
          required
        />

        <Select
          label="Account Type"
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value as AccountType })}
          options={ACCOUNT_TYPES}
        />

        <Input
          label="Bank / Institution"
          value={formData.bank}
          onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
          placeholder="e.g., Chase, Bank of America"
        />

        <Input
          label="Initial Balance"
          type="number"
          step="0.01"
          value={formData.initialBalance}
          onChange={(e) => setFormData({ ...formData, initialBalance: parseFloat(e.target.value) || 0 })}
        />

        {formData.type === 'CREDIT_CARD' && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Auto-filled when you upload a fatura (PDF), but editable here.
            </p>
            <Input
              label="Credit limit"
              type="number"
              step="0.01"
              min={0}
              placeholder="e.g., 5000"
              value={formData.creditLimit ?? ''}
              onChange={(e) =>
                setFormData({ ...formData, creditLimit: e.target.value ? parseFloat(e.target.value) : null })
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Closing day"
                type="number"
                min={1}
                max={31}
                placeholder="1–31"
                value={formData.closingDay ?? ''}
                onChange={(e) =>
                  setFormData({ ...formData, closingDay: e.target.value ? parseInt(e.target.value, 10) : null })
                }
              />
              <Input
                label="Due day"
                type="number"
                min={1}
                max={31}
                placeholder="1–31"
                value={formData.dueDay ?? ''}
                onChange={(e) =>
                  setFormData({ ...formData, dueDay: e.target.value ? parseInt(e.target.value, 10) : null })
                }
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Opening date</label>
          <p className="mb-2 text-xs text-muted-foreground">
            When the account was opened. Statements before this date are hidden.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Combobox
              value={formData.openingMonth ? String(formData.openingMonth) : ''}
              onChange={(v) => setFormData({ ...formData, openingMonth: v ? Number(v) : null })}
              options={MONTH_OPTIONS}
              placeholder="Month"
              searchPlaceholder="Search month…"
            />
            <Input
              type="number"
              min={1970}
              max={new Date().getFullYear()}
              placeholder="Year"
              value={formData.openingYear ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  openingYear: e.target.value ? parseInt(e.target.value, 10) : null,
                })
              }
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Color</label>
          <div className="flex gap-2.5 flex-wrap">
            {COLORS.map((color) => {
              const isSelected = formData.color === color;
              return (
                <button
                  key={color}
                  type="button"
                  aria-label={`Select color ${color}`}
                  aria-pressed={isSelected}
                  className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 ring-offset-2 ring-offset-card hover:scale-105 ${
                    isSelected
                      ? 'ring-2 scale-110 shadow-md'
                      : 'ring-0 hover:ring-2 hover:ring-border'
                  }`}
                  style={{ backgroundColor: color, ['--tw-ring-color' as string]: color }}
                  onClick={() => setFormData({ ...formData, color })}
                >
                  {isSelected && <Check className="w-5 h-5 text-white drop-shadow" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-4">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">
            {account ? 'Save Changes' : 'Add Account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
