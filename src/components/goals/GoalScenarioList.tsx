'use client';

import { useState, useCallback } from 'react';
import { Plus, Trash2, GitCompare } from 'lucide-react';
import { Button, Badge, useToast } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import type { Goal, StoredGoalScenario } from '@/lib/goals/types';
import type { ScenarioProjection } from '@/lib/goals/scenarios';
import { GoalScenarioForm, ScenarioFormData } from './GoalScenarioForm';

interface CategoryOption {
  id: string;
  name: string;
}

interface GoalScenarioListProps {
  goal: Goal;
  scenarios: StoredGoalScenario[];
  categories: CategoryOption[];
  onChange: () => void;
}

function parseProjection(json: string | null): ScenarioProjection | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as ScenarioProjection;
  } catch {
    return null;
  }
}

function riskVariant(risk?: string | null): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (risk === 'low') return 'success';
  if (risk === 'medium') return 'warning';
  if (risk === 'high') return 'destructive';
  return 'secondary';
}

export function GoalScenarioList({ goal, scenarios, categories, onChange }: GoalScenarioListProps) {
  const toast = useToast();
  const { hideSensitiveValues } = useSensitiveValues();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleAdd = useCallback(
    async (data: ScenarioFormData) => {
      try {
        const res = await fetch(`/api/goals/${goal.id}/scenarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to save scenario');
        }
        toast.success('Scenario saved');
        setIsFormOpen(false);
        onChange();
      } catch (error) {
        console.error('Failed to save scenario:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to save scenario');
      }
    },
    [goal.id, toast, onChange],
  );

  const handleDelete = useCallback(
    async (scenarioId: string) => {
      if (!window.confirm('Remove this scenario?')) return;
      try {
        const res = await fetch(`/api/goals/${goal.id}/scenarios/${scenarioId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to remove scenario');
        toast.success('Scenario removed');
        onChange();
      } catch (error) {
        console.error('Failed to remove scenario:', error);
        toast.error('Failed to remove scenario');
      }
    },
    [goal.id, toast, onChange],
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <GitCompare className="h-4 w-4 text-primary" />
          Scenarios
        </p>
        <Button size="sm" variant="outline" onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          No scenarios yet. Simulate spending cuts, income increases, or savings rates to compare outcomes.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Scenario</th>
                <th className="px-4 py-2 font-medium">Effective / mo</th>
                <th className="px-4 py-2 font-medium">Completion</th>
                <th className="px-4 py-2 font-medium">Outcome</th>
                <th className="px-4 py-2 font-medium">Risk</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {scenarios.map((s) => {
                const proj = parseProjection(s.projectedResult);
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{s.title}</td>
                    <td className="px-4 py-3 text-foreground">
                      {proj ? formatCurrency(proj.effectiveMonthly, { hideSensitiveValues }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {proj?.projectedCompletionDate
                        ? formatDate(proj.projectedCompletionDate)
                        : 'Not reachable'}
                    </td>
                    <td className="px-4 py-3">
                      {proj?.meetsTargetDate == null ? (
                        <span className="text-muted-foreground">No deadline</span>
                      ) : (
                        <Badge variant={proj.meetsTargetDate ? 'success' : 'destructive'}>
                          {proj.meetsTargetDate ? 'Meets date' : 'Misses date'}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={riskVariant(s.riskLevel)}>{s.riskLevel ?? '—'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        aria-label="Remove scenario"
                        onClick={() => handleDelete(s.id)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <GoalScenarioForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleAdd}
        goal={goal}
        categories={categories}
      />
    </div>
  );
}
