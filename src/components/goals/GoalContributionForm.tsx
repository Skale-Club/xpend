'use client';

import { useState, useCallback } from 'react';
import { Button, Input, Select, Modal } from '@/components/ui';

export interface ContributionFormData {
  amount: number;
  date: string;
  accountId: string;
  note: string;
}

interface AccountOption {
  id: string;
  name: string;
}

interface GoalContributionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ContributionFormData) => void;
  accounts: AccountOption[];
}

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function getInitialData(): ContributionFormData {
  return { amount: 0, date: todayInput(), accountId: '', note: '' };
}

export function GoalContributionForm({ isOpen, onClose, onSubmit, accounts }: GoalContributionFormProps) {
  const [formData, setFormData] = useState<ContributionFormData>(getInitialData);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
      setFormData(getInitialData());
    },
    [formData, onSubmit],
  );

  const handleClose = useCallback(() => {
    setFormData(getInitialData());
    onClose();
  }, [onClose]);

  const accountOptions = [
    { value: '', label: 'None' },
    ...accounts.map((a) => ({ value: a.id, label: a.name })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Contribution" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          min="0"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
          required
          autoFocus
        />
        <Input
          label="Date"
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
        />
        <Select
          label="From Account"
          value={formData.accountId}
          onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
          options={accountOptions}
        />
        <Input
          label="Note"
          value={formData.note}
          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          placeholder="Optional"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">Add Contribution</Button>
        </div>
      </form>
    </Modal>
  );
}
