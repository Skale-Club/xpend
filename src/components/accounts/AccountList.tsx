'use client';

import { useState } from 'react';
import { Building2, PiggyBank, CreditCard, Smartphone, Wallet, CircleDollarSign, Plus, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Card as UICard, CardContent, Button, Modal } from '@/components/ui';
import { Account, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ICONS } from '@/types';
import { formatCurrency } from '@/lib/utils';

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
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState<string | null>(null);

  const getIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName] || CircleDollarSign;
    return IconComponent;
  };

  return (
    <UICard>
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Accounts</h2>
        <Button size="sm" onClick={onAddAccount}>
          <Plus className="w-4 h-4 mr-1" />
          Add Account
        </Button>
      </div>
      <CardContent className="p-0">
        {accounts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CircleDollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No accounts yet</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={onAddAccount}>
              Add your first account
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {accounts.map((account) => {
              const IconComponent = getIcon(ACCOUNT_TYPE_ICONS[account.type]);
              const balance = balances[account.id] ?? account.initialBalance;
              return (
                <div key={account.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${account.color}20` }}
                      >
                        <IconComponent className="w-5 h-5" style={{ color: account.color }} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{account.name}</p>
                        <p className="text-sm text-gray-500">
                          {account.bank} • {ACCOUNT_TYPE_LABELS[account.type]}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-semibold ${balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                          {formatCurrency(balance)}
                        </p>
                        <p className="text-xs text-gray-500">Current Balance</p>
                      </div>
                      <div className="relative">
                        <button
                          className="p-1 rounded-lg hover:bg-gray-100"
                          onClick={() => setMenuOpen(menuOpen === account.id ? null : account.id)}
                        >
                          <MoreVertical className="w-5 h-5 text-gray-400" />
                        </button>
                        {menuOpen === account.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                            <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-100 z-20">
                              <button
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                onClick={() => {
                                  onEditAccount(account);
                                  setMenuOpen(null);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                                onClick={() => {
                                  setDeleteModalOpen(account.id);
                                  setMenuOpen(null);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Modal
        isOpen={!!deleteModalOpen}
        onClose={() => setDeleteModalOpen(null)}
        title="Delete Account"
        size="sm"
      >
        <p className="text-gray-600 mb-4">
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
    </UICard>
  );
}
