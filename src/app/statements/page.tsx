'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, Combobox, Loader } from '@/components/ui';
import { TimelineUpload, TimelineYearSelector } from '@/components/statements';
import { Account } from '@/types';
import { getCurrentMonthYear } from '@/lib/utils';

export default function StatementsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState(getCurrentMonthYear().year);
  const [statements, setStatements] = useState<{ id?: string; month: number; year: number; uploadedAt?: string; fileName?: string; hasTransactions?: boolean; uncategorizedCount?: number; aiCategorized?: boolean }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatementsLoading, setIsStatementsLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  // The account's opening year is the single source of truth for how far back
  // statements can go. Fall back to a 5-year window when it isn't set.
  const lowerYear = selectedAccount?.openingYear ?? currentYear - 5;

  const years = [];
  for (let y = currentYear; y >= lowerYear; y--) {
    years.push(y);
  }

  // Keep the selected year within the derived range when the account changes.
  useEffect(() => {
    if (selectedYear < lowerYear) setSelectedYear(lowerYear);
    else if (selectedYear > currentYear) setSelectedYear(currentYear);
  }, [lowerYear, currentYear, selectedYear]);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data);
      if (data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId]);

  const fetchStatements = useCallback(async () => {
    if (!selectedAccountId) return;
    setIsStatementsLoading(true);
    try {
      const res = await fetch(`/api/statements?accountId=${selectedAccountId}&year=${selectedYear}`);
      const data = await res.json();
      setStatements(data.map((s: { id: string; month: number; year: number; uploadedAt?: string; fileName?: string; hasTransactions?: boolean; uncategorizedCount?: number; aiCategorized?: boolean }) => ({
        id: s.id,
        month: s.month,
        year: s.year,
        uploadedAt: s.uploadedAt,
        fileName: s.fileName,
        hasTransactions: s.hasTransactions,
        uncategorizedCount: s.uncategorizedCount,
        aiCategorized: s.aiCategorized,
      })));
    } catch (error) {
      console.error('Failed to fetch statements:', error);
    } finally {
      setIsStatementsLoading(false);
    }
  }, [selectedAccountId, selectedYear]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  const handleUpload = async (month: number, year: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', selectedAccountId);
    formData.append('month', month.toString());
    formData.append('year', year.toString());

    const res = await fetch('/api/statements/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      throw new Error('Upload failed');
    }

    // Wait for upload response, then fetch updated statements
    await res.json();
    await fetchStatements();
  };

  const handleDelete = async (statementId: string) => {
    const res = await fetch(`/api/statements/${statementId}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      throw new Error('Delete failed');
    }

    fetchStatements();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] w-full">
        <Loader size={80} />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Upload Statements</h1>
          <p className="text-muted-foreground mt-1">Upload your bank statements month by month</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please create an account first to upload statements.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Upload Statements</h1>
        <p className="text-muted-foreground mt-1">Upload your bank statements month by month</p>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-end gap-3">
            <div className="w-72 sm:w-80 flex-shrink-0">
              <Combobox
                label="Select Account"
                value={selectedAccountId}
                onChange={setSelectedAccountId}
                options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                placeholder="Select an account…"
                searchPlaceholder="Search accounts…"
              />
            </div>
            <TimelineYearSelector
              years={years}
              selectedYear={selectedYear}
              onSelectYear={setSelectedYear}
              disabled={!selectedAccount}
            />
          </div>
        </CardContent>
      </Card>

      {selectedAccountId && (
        isStatementsLoading ? (
          <div className="flex items-center justify-center min-h-[50vh] w-full">
            <Loader size={80} />
          </div>
        ) : (
          <TimelineUpload
            accountId={selectedAccountId}
            year={selectedYear}
            existingStatements={statements}
            onUpload={handleUpload}
            onDelete={handleDelete}
            onRefresh={fetchStatements}
            openingMonth={selectedAccount?.openingMonth}
            openingYear={selectedAccount?.openingYear}
          />
        )
      )}
    </div>
  );
}
