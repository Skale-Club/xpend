'use client';

import { useState, useCallback } from 'react';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import type { GoalContribution } from '@/lib/goals/types';
import { GoalContributionForm, ContributionFormData } from './GoalContributionForm';

interface AccountOption {
  id: string;
  name: string;
}

interface GoalContributionListProps {
  goalId: string;
  contributions: GoalContribution[];
  accounts: AccountOption[];
  onChange: () => void;
}

export function GoalContributionList({
  goalId,
  contributions,
  accounts,
  onChange,
}: GoalContributionListProps) {
  const toast = useToast();
  const { hideSensitiveValues } = useSensitiveValues();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleAdd = useCallback(
    async (data: ContributionFormData) => {
      try {
        const res = await fetch(`/api/goals/${goalId}/contributions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to add contribution');
        }
        toast.success('Contribution added');
        setIsFormOpen(false);
        onChange();
      } catch (error) {
        console.error('Failed to add contribution:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to add contribution');
      }
    },
    [goalId, toast, onChange],
  );

  const handleDelete = useCallback(
    async (contributionId: string) => {
      if (!window.confirm('Remove this contribution? Goal progress will be adjusted.')) return;
      try {
        const res = await fetch(`/api/goals/${goalId}/contributions/${contributionId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to remove contribution');
        toast.success('Contribution removed');
        onChange();
      } catch (error) {
        console.error('Failed to remove contribution:', error);
        toast.error('Failed to remove contribution');
      }
    },
    [goalId, toast, onChange],
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Contributions</p>
        <Button size="sm" variant="outline" onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {contributions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          No contributions yet. Add one to track progress toward this goal.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {contributions.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-success">
                  + {formatCurrency(c.amount, { hideSensitiveValues })}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{formatDate(c.date)}</span>
                  {c.account && (
                    <span className="inline-flex items-center gap-1">
                      <Wallet className="h-3 w-3" />
                      {c.account.name}
                    </span>
                  )}
                  {c.note && <span className="truncate">· {c.note}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(c.id)}
                aria-label="Remove contribution"
                className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <GoalContributionForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleAdd}
        accounts={accounts}
      />
    </div>
  );
}
