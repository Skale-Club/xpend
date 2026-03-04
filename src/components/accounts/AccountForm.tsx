'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button, Input, Select, Modal } from '@/components/ui';
import { Account, AccountType, ACCOUNT_TYPE_LABELS } from '@/types';

interface AccountFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AccountFormData) => void;
  account?: Account | null;
}

export interface AccountFormData {
  name: string;
  type: AccountType;
  bank: string;
  color: string;
  initialBalance: number;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

const ACCOUNT_TYPES = Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function getInitialFormData(account?: Account | null): AccountFormData {
  if (account) {
    return {
      name: account.name,
      type: account.type,
      bank: account.bank || '',
      color: account.color,
      initialBalance: account.initialBalance,
    };
  }
  return {
    name: '',
    type: 'CHECKING',
    bank: '',
    color: COLORS[0],
    initialBalance: 0,
  };
}

export function AccountForm({ isOpen, onClose, onSubmit, account }: AccountFormProps) {
  // Memoize initial form data based on account
  const initialData = useMemo(() => getInitialFormData(account), [account]);
  const [formData, setFormData] = useState<AccountFormData>(initialData);

  // Track previous account id to detect changes
  const [prevAccountId, setPrevAccountId] = useState<string | null | undefined>(account?.id);

  // Sync form when account changes (edit different account)
  if (account?.id !== prevAccountId) {
    setPrevAccountId(account?.id);
    setFormData(getInitialFormData(account));
  }

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  }, [formData, onSubmit]);

  const handleClose = useCallback(() => {
    // Reset form to initial state on close
    setFormData(getInitialFormData(null));
    setPrevAccountId(null);
    onClose();
  }, [onClose]);

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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-8 h-8 rounded-lg border-2 transition-transform ${formData.color === color ? 'border-gray-900 scale-110' : 'border-transparent'
                  }`}
                style={{ backgroundColor: color }}
                onClick={() => setFormData({ ...formData, color })}
              />
            ))}
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
