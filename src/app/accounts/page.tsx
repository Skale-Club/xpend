'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { AccountList, AccountForm, AccountFormData } from '@/components/accounts';
import { Account, ACCOUNT_TYPE_LABELS } from '@/types';
import { useToast, Loader, Button } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();
  const { hideSensitiveValues } = useSensitiveValues();

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data);

      const balancesRes = await fetch('/api/dashboard');
      const balancesData = await balancesRes.json();
      setBalances(balancesData.balances || {});
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      toast.error('Failed to load accounts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleAddAccount = () => {
    setEditingAccount(null);
    setIsFormOpen(true);
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setIsFormOpen(true);
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete account');
      }
      toast.success('Account deleted successfully');
      fetchAccounts();
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete account');
    }
  };

  const handleSubmit = async (data: AccountFormData) => {
    try {
      const res = editingAccount
        ? await fetch(`/api/accounts/${editingAccount.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        : await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save account');
      }

      toast.success(editingAccount ? 'Account updated successfully' : 'Account created successfully');
      setIsFormOpen(false);
      fetchAccounts();
    } catch (error) {
      console.error('Failed to save account:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save account');
    }
  };

  // Compute stats
  const activeAccounts = accounts.filter(a => a.isActive);
  const totalBalance = accounts.reduce((sum, a) => {
    const balance = balances[a.id] ?? a.initialBalance;
    return sum + balance;
  }, 0);
  const positiveBalance = accounts.reduce((sum, a) => {
    const balance = balances[a.id] ?? a.initialBalance;
    return balance > 0 ? sum + balance : sum;
  }, 0);
  const negativeBalance = accounts.reduce((sum, a) => {
    const balance = balances[a.id] ?? a.initialBalance;
    return balance < 0 ? sum + balance : sum;
  }, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] w-full">
        <Loader size={80} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-600">Manage your bank accounts and cards</p>
        </div>
        <Button onClick={handleAddAccount}>
          <Plus className="w-5 h-5 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600">Total Accounts</p>
          <p className="text-2xl font-bold text-blue-600">{activeAccounts.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600">Net Balance</p>
          <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totalBalance, { hideSensitiveValues })}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600">Assets</p>
          <p className="text-2xl font-bold text-emerald-600">
            {formatCurrency(positiveBalance, { hideSensitiveValues })}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600">Liabilities</p>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(Math.abs(negativeBalance), { hideSensitiveValues })}
          </p>
        </div>
      </div>

      <AccountList
        accounts={accounts}
        balances={balances}
        onAddAccount={handleAddAccount}
        onEditAccount={handleEditAccount}
        onDeleteAccount={handleDeleteAccount}
      />

      <AccountForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmit}
        account={editingAccount}
      />
    </div>
  );
}
