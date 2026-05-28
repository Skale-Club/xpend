'use client';

import { useState, useCallback, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Input, Select, Modal, Badge } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import { computeGoalProgress } from '@/lib/goals/calculations';
import { simulateScenario, type ScenarioInput } from '@/lib/goals/scenarios';
import type { Goal, GoalScenarioType } from '@/lib/goals/types';

export interface ScenarioFormData {
  title: string;
  scenarioType: GoalScenarioType;
  monthlySavings: number;
  spendingCuts: { category: string; amount: number }[];
  incomeIncrease: { source: string; amount: number }[];
}

interface CategoryOption {
  id: string;
  name: string;
}

interface GoalScenarioFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ScenarioFormData) => void;
  goal: Goal;
  categories: CategoryOption[];
}

const TYPE_OPTIONS: { value: GoalScenarioType; label: string }[] = [
  { value: 'SAVINGS_RATE', label: 'Savings rate' },
  { value: 'SPENDING_CUT', label: 'Spending cut' },
  { value: 'INCOME_INCREASE', label: 'Income increase' },
  { value: 'CUSTOM', label: 'Custom' },
];

function getInitial(): ScenarioFormData {
  return {
    title: '',
    scenarioType: 'SAVINGS_RATE',
    monthlySavings: 0,
    spendingCuts: [],
    incomeIncrease: [],
  };
}

export function GoalScenarioForm({ isOpen, onClose, onSubmit, goal, categories }: GoalScenarioFormProps) {
  const { hideSensitiveValues } = useSensitiveValues();
  const [formData, setFormData] = useState<ScenarioFormData>(getInitial);

  const projection = useMemo(() => {
    const calc = computeGoalProgress(goal);
    const input: ScenarioInput = {
      monthlySavings: formData.monthlySavings,
      spendingCuts: formData.spendingCuts,
      incomeIncrease: formData.incomeIncrease,
    };
    return simulateScenario(goal, calc, input);
  }, [goal, formData]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
      setFormData(getInitial());
    },
    [formData, onSubmit],
  );

  const handleClose = useCallback(() => {
    setFormData(getInitial());
    onClose();
  }, [onClose]);

  const categoryOptions = [
    { value: '', label: 'Select category' },
    ...categories.map((c) => ({ value: c.name, label: c.name })),
  ];

  const addCut = () =>
    setFormData((d) => ({ ...d, spendingCuts: [...d.spendingCuts, { category: '', amount: 0 }] }));
  const addIncome = () =>
    setFormData((d) => ({ ...d, incomeIncrease: [...d.incomeIncrease, { source: '', amount: 0 }] }));

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Scenario" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Scenario Title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Cut dining + save $300/mo"
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Type"
            value={formData.scenarioType}
            onChange={(e) => setFormData({ ...formData, scenarioType: e.target.value as GoalScenarioType })}
            options={TYPE_OPTIONS}
          />
          <Input
            label="Base Monthly Savings"
            type="number"
            step="0.01"
            min="0"
            value={formData.monthlySavings}
            onChange={(e) => setFormData({ ...formData, monthlySavings: parseFloat(e.target.value) || 0 })}
          />
        </div>

        {/* Spending cuts */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Spending cuts (per month)</label>
            <Button type="button" size="sm" variant="ghost" onClick={addCut}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {formData.spendingCuts.map((cut, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    value={cut.category}
                    options={categoryOptions}
                    onChange={(e) =>
                      setFormData((d) => {
                        const next = [...d.spendingCuts];
                        next[i] = { ...next[i], category: e.target.value };
                        return { ...d, spendingCuts: next };
                      })
                    }
                  />
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-28"
                  value={cut.amount}
                  onChange={(e) =>
                    setFormData((d) => {
                      const next = [...d.spendingCuts];
                      next[i] = { ...next[i], amount: parseFloat(e.target.value) || 0 };
                      return { ...d, spendingCuts: next };
                    })
                  }
                />
                <button
                  type="button"
                  aria-label="Remove cut"
                  className="mb-1 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() =>
                    setFormData((d) => ({ ...d, spendingCuts: d.spendingCuts.filter((_, idx) => idx !== i) }))
                  }
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Income increases */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Income increases (per month)</label>
            <Button type="button" size="sm" variant="ghost" onClick={addIncome}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {formData.incomeIncrease.map((inc, i) => (
              <div key={i} className="flex items-end gap-2">
                <Input
                  className="flex-1"
                  placeholder="Source (e.g., freelance)"
                  value={inc.source}
                  onChange={(e) =>
                    setFormData((d) => {
                      const next = [...d.incomeIncrease];
                      next[i] = { ...next[i], source: e.target.value };
                      return { ...d, incomeIncrease: next };
                    })
                  }
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-28"
                  value={inc.amount}
                  onChange={(e) =>
                    setFormData((d) => {
                      const next = [...d.incomeIncrease];
                      next[i] = { ...next[i], amount: parseFloat(e.target.value) || 0 };
                      return { ...d, incomeIncrease: next };
                    })
                  }
                />
                <button
                  type="button"
                  aria-label="Remove income"
                  className="mb-1 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() =>
                    setFormData((d) => ({ ...d, incomeIncrease: d.incomeIncrease.filter((_, idx) => idx !== i) }))
                  }
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Live projection preview */}
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Projection preview
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>
              Effective:{' '}
              <span className="font-bold text-foreground">
                {formatCurrency(projection.effectiveMonthly, { hideSensitiveValues })}/mo
              </span>
            </span>
            <span className="text-muted-foreground">
              {projection.projectedCompletionDate
                ? `Done by ${formatDate(projection.projectedCompletionDate)}`
                : 'Not reachable'}
            </span>
            {projection.meetsTargetDate != null && (
              <Badge variant={projection.meetsTargetDate ? 'success' : 'destructive'}>
                {projection.meetsTargetDate ? 'Meets target date' : 'Misses target date'}
              </Badge>
            )}
            <Badge
              variant={
                projection.riskLevel === 'low'
                  ? 'success'
                  : projection.riskLevel === 'medium'
                    ? 'warning'
                    : 'destructive'
              }
            >
              {projection.riskLevel} risk
            </Badge>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">Save Scenario</Button>
        </div>
      </form>
    </Modal>
  );
}
