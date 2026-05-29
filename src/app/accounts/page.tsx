'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { AccountList, AccountForm, AccountFormData } from '@/components/accounts';
import { Account, CreditCardSummary } from '@/types';
import { useToast, Loader, Button } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [creditSummaries, setCreditSummaries] = useState<Record<string, CreditCardSummary>>({});
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

      const creditRes = await fetch('/api/credit-cards');
      if (creditRes.ok) {
        const creditData: CreditCardSummary[] = await creditRes.json();
        setCreditSummaries(
          Object.fromEntries(creditData.map((s) => [s.accountId, s])),
        );
      }
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

  const handleReorder = async (orderedIds: string[]) => {
    // Optimistically apply the new order.
    setAccounts((prev) => {
      const byId = new Map(prev.map((a) => [a.id, a]));
      return orderedIds.map((id) => byId.get(id)!).filter(Boolean);
    });
    try {
      const res = await fetch('/api/accounts/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });
      if (!res.ok) throw new Error('Failed to save order');
    } catch (error) {
      console.error('Failed to reorder accounts:', error);
      toast.error('Failed to save the new order');
      fetchAccounts();
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your bank accounts and cards</p>
        </div>
        <Button onClick={handleAddAccount}>
          <Plus className="h-4 w-4" />
          Add Account
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Accounts</p>
          <p className="text-2xl font-bold text-primary mt-1">{activeAccounts.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Net Balance</p>
          <p className={`text-2xl font-bold mt-1 ${totalBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatCurrency(totalBalance, { hideSensitiveValues })}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assets</p>
          <p className="text-2xl font-bold text-success mt-1">
            {formatCurrency(positiveBalance, { hideSensitiveValues })}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Liabilities</p>
          <p className="text-2xl font-bold text-destructive mt-1">
            {formatCurrency(Math.abs(negativeBalance), { hideSensitiveValues })}
          </p>
        </div>
      </div>

      <AccountList
        accounts={accounts}
        balances={balances}
        creditSummaries={creditSummaries}
        onAddAccount={handleAddAccount}
        onEditAccount={handleEditAccount}
        onDeleteAccount={handleDeleteAccount}
        onReorder={handleReorder}
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
