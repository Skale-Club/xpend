'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button, Input, Select, Modal } from '@/components/ui';
import {
  GOAL_TYPE_LABELS,
  GOAL_STATUS_LABELS,
  GOAL_PRIORITY_LABELS,
  type Goal,
  type GoalType,
  type GoalStatus,
  type GoalPriority,
} from '@/lib/goals/types';

export interface GoalFormData {
  name: string;
  type: GoalType;
  status: GoalStatus;
  priority: GoalPriority;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  interestRate: string;
  minimumPayment: string;
  monthsOfCoverage: string;
  description: string;
  linkedAccountId: string;
  linkedCategoryId: string;
}

interface AccountOption {
  id: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface GoalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: GoalFormData) => void;
  goal?: Goal | null;
  accounts: AccountOption[];
  categories: CategoryOption[];
}

const TYPE_OPTIONS = (Object.entries(GOAL_TYPE_LABELS) as [GoalType, string][]).map(
  ([value, label]) => ({ value, label }),
);
const STATUS_OPTIONS = (Object.entries(GOAL_STATUS_LABELS) as [GoalStatus, string][]).map(
  ([value, label]) => ({ value, label }),
);
const PRIORITY_OPTIONS = (Object.entries(GOAL_PRIORITY_LABELS) as [GoalPriority, string][]).map(
  ([value, label]) => ({ value, label }),
);

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function getInitialFormData(goal?: Goal | null): GoalFormData {
  if (goal) {
    return {
      name: goal.name,
      type: goal.type,
      status: goal.status,
      priority: goal.priority,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      targetDate: toDateInput(goal.targetDate),
      interestRate: goal.interestRate != null ? String(goal.interestRate) : '',
      minimumPayment: goal.minimumPayment != null ? String(goal.minimumPayment) : '',
      monthsOfCoverage: goal.monthsOfCoverage != null ? String(goal.monthsOfCoverage) : '',
      description: goal.description || '',
      linkedAccountId: goal.linkedAccountId || '',
      linkedCategoryId: goal.linkedCategoryId || '',
    };
  }
  return {
    name: '',
    type: 'SAVINGS',
    status: 'ACTIVE',
    priority: 'MEDIUM',
    targetAmount: 0,
    currentAmount: 0,
    targetDate: '',
    interestRate: '',
    minimumPayment: '',
    monthsOfCoverage: '',
    description: '',
    linkedAccountId: '',
    linkedCategoryId: '',
  };
}

export function GoalForm({ isOpen, onClose, onSubmit, goal, accounts, categories }: GoalFormProps) {
  const initialData = useMemo(() => getInitialFormData(goal), [goal]);
  const [formData, setFormData] = useState<GoalFormData>(initialData);
  const [prevGoalId, setPrevGoalId] = useState<string | null | undefined>(goal?.id);

  if (goal?.id !== prevGoalId) {
    setPrevGoalId(goal?.id);
    setFormData(getInitialFormData(goal));
  }

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    },
    [formData, onSubmit],
  );

  const handleClose = useCallback(() => {
    setFormData(getInitialFormData(null));
    setPrevGoalId(null);
    onClose();
  }, [onClose]);

  const isDebt = formData.type === 'DEBT_PAYOFF';
  const isEmergency = formData.type === 'EMERGENCY_FUND';
  const targetLabel = isDebt ? 'Total Debt Amount' : 'Target Amount';
  const currentLabel = isDebt ? 'Amount Paid Off' : 'Current Saved Amount';

  const accountOptions = [
    { value: '', label: 'None' },
    ...accounts.map((a) => ({ value: a.id, label: a.name })),
  ];
  const categoryOptions = [
    { value: '', label: 'None' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={goal ? 'Edit Goal' : 'New Goal'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Goal Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Trip to Japan"
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select
            label="Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as GoalType })}
            options={TYPE_OPTIONS}
          />
          <Select
            label="Priority"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value as GoalPriority })}
            options={PRIORITY_OPTIONS}
          />
          <Select
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as GoalStatus })}
            options={STATUS_OPTIONS}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={targetLabel}
            type="number"
            step="0.01"
            min="0"
            value={formData.targetAmount}
            onChange={(e) => setFormData({ ...formData, targetAmount: parseFloat(e.target.value) || 0 })}
          />
          <Input
            label={currentLabel}
            type="number"
            step="0.01"
            min="0"
            value={formData.currentAmount}
            onChange={(e) => setFormData({ ...formData, currentAmount: parseFloat(e.target.value) || 0 })}
          />
        </div>

        <Input
          label="Target Date"
          type="date"
          value={formData.targetDate}
          onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
          helperText="Optional. Required savings is calculated from this date."
        />

        {isDebt && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Interest Rate (% / year)"
              type="number"
              step="0.01"
              min="0"
              value={formData.interestRate}
              onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
              placeholder="Optional"
            />
            <Input
              label="Minimum Monthly Payment"
              type="number"
              step="0.01"
              min="0"
              value={formData.minimumPayment}
              onChange={(e) => setFormData({ ...formData, minimumPayment: e.target.value })}
              placeholder="Optional"
            />
          </div>
        )}

        {isEmergency && (
          <Input
            label="Desired Months of Coverage"
            type="number"
            step="1"
            min="0"
            value={formData.monthsOfCoverage}
            onChange={(e) => setFormData({ ...formData, monthsOfCoverage: e.target.value })}
            placeholder="e.g., 3"
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Linked Account"
            value={formData.linkedAccountId}
            onChange={(e) => setFormData({ ...formData, linkedAccountId: e.target.value })}
            options={accountOptions}
          />
          <Select
            label="Linked Category"
            value={formData.linkedCategoryId}
            onChange={(e) => setFormData({ ...formData, linkedCategoryId: e.target.value })}
            options={categoryOptions}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Description</label>
          <textarea
            className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional notes about this goal"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">{goal ? 'Save Changes' : 'Create Goal'}</Button>
        </div>
      </form>
    </Modal>
  );
}
