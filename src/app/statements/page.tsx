'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardContent, Select } from '@/components/ui';
import { TimelineUpload, TimelineYearSelector } from '@/components/statements';
import { Account } from '@/types';
import { getCurrentMonthYear } from '@/lib/utils';

export default function StatementsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState(getCurrentMonthYear().year);
  const [statements, setStatements] = useState<{ month: number; year: number; uploadedAt?: string; fileName?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y);
  }

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
    try {
      const res = await fetch(`/api/statements?accountId=${selectedAccountId}&year=${selectedYear}`);
      const data = await res.json();
      setStatements(data.map((s: { id: string; month: number; year: number; uploadedAt?: string; fileName?: string; hasTransactions?: boolean }) => ({
        id: s.id,
        month: s.month,
        year: s.year,
        uploadedAt: s.uploadedAt,
        fileName: s.fileName,
        hasTransactions: s.hasTransactions,
      })));
    } catch (error) {
      console.error('Failed to fetch statements:', error);
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

    fetchStatements();
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
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Statements</h1>
          <p className="text-gray-500 mt-1">Upload your bank statements month by month</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Please create an account first to upload statements.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Statements</h1>
        <p className="text-gray-500 mt-1">Upload your bank statements month by month</p>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Select
                label="Select Account"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              />
            </div>
            <div className="pt-6">
              <TimelineYearSelector
                years={years}
                selectedYear={selectedYear}
                onSelectYear={setSelectedYear}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedAccountId && (
        <TimelineUpload
          accountId={selectedAccountId}
          year={selectedYear}
          existingStatements={statements}
          onUpload={handleUpload}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
