'use client';

import { useState } from 'react';
import { Building2, PiggyBank, CreditCard, Smartphone, Wallet, CircleDollarSign, Edit, Trash2 } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { Account, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ICONS } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

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
  onAddAccount: () => void;
  onEditAccount: (account: Account) => void;
  onDeleteAccount: (accountId: string) => void;
}

export function AccountList({ accounts, balances, onAddAccount, onEditAccount, onDeleteAccount }: AccountListProps) {
  const [deleteModalOpen, setDeleteModalOpen] = useState<string | null>(null);
  const { hideSensitiveValues } = useSensitiveValues();

  const getIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName] || CircleDollarSign;
    return IconComponent;
  };

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
        <CircleDollarSign className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No accounts</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by adding your first account.</p>
        <div className="mt-6">
          <Button onClick={onAddAccount}>Add Account</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {accounts.map((account) => {
          const IconComponent = getIcon(ACCOUNT_TYPE_ICONS[account.type]);
          const balance = balances[account.id] ?? account.initialBalance;
          const isInactive = !account.isActive;

          return (
            <div
              key={account.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 transition-opacity ${
                isInactive ? 'opacity-60 border-gray-400' :
                balance < 0 ? 'border-red-500' :
                'border-blue-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${account.color}20` }}
                  >
                    <IconComponent className="w-6 h-6" style={{ color: account.color }} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`font-semibold ${isInactive ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                        {account.name}
                      </h3>
                      {isInactive && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                      {account.bank && <span>{account.bank}</span>}
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        {ACCOUNT_TYPE_LABELS[account.type]}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Balance */}
                  <div className="text-right">
                    <p className={`font-bold text-lg ${balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(balance, { hideSensitiveValues })}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Current Balance</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEditAccount(account)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setDeleteModalOpen(account.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
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
        <p className="text-gray-600 dark:text-gray-400 mb-4">
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
