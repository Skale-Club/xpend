'use client';

import { useEffect, useState, useCallback } from 'react';
import { AccountList, AccountForm, AccountFormData } from '@/components/accounts';
import { Account } from '@/types';
import { useToast } from '@/components/ui';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
        <p className="text-gray-500 mt-1">Manage your bank accounts and cards</p>
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
