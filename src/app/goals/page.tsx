'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Target } from 'lucide-react';
import { GoalCard, GoalForm, GoalFormData, DebtStrategyPanel } from '@/components/goals';
import { useToast, Loader, Button } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import { computeGoalProgress } from '@/lib/goals/calculations';
import { computeRiskStatus } from '@/lib/goals/status';
import { readArrayResponse } from '@/lib/http';
import type { Goal } from '@/lib/goals/types';

interface AccountOption { id: string; name: string }
interface CategoryOption { id: string; name: string }

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();
  const { hideSensitiveValues } = useSensitiveValues();

  const fetchGoals = useCallback(async () => {
    setIsLoading(true);
    try {
      const [goalsRes, accountsRes, categoriesRes] = await Promise.all([
        fetch('/api/goals'),
        fetch('/api/accounts'),
        fetch('/api/categories'),
      ]);
      setGoals(await readArrayResponse<Goal>(goalsRes, 'Goals'));
      setAccounts(await readArrayResponse<AccountOption>(accountsRes, 'Accounts'));
      setCategories(await readArrayResponse<CategoryOption>(categoriesRes, 'Categories'));
    } catch (error) {
      console.error('Failed to fetch goals:', error);
      toast.error('Failed to load goals. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleSubmit = useCallback(
    async (data: GoalFormData) => {
      try {
        const res = await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to save goal');
        }
        toast.success('Goal created successfully');
        setIsFormOpen(false);
        fetchGoals();
      } catch (error) {
        console.error('Failed to save goal:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to save goal');
      }
    },
    [toast, fetchGoals],
  );

  // Stats over non-archived goals.
  const visibleGoals = goals.filter((g) => g.status !== 'ARCHIVED');
  const activeGoals = visibleGoals.filter((g) => g.status === 'ACTIVE');
  const completedGoals = goals.filter((g) => g.status === 'COMPLETED');

  let totalTarget = 0;
  let totalSaved = 0;
  let monthlyRequired = 0;
  let atRiskCount = 0;

  for (const goal of activeGoals) {
    const calc = computeGoalProgress(goal);
    const risk = computeRiskStatus(goal, calc);
    totalTarget += goal.targetAmount;
    totalSaved += goal.currentAmount;
    if (calc.requiredMonthly) monthlyRequired += calc.requiredMonthly;
    if (risk === 'AT_RISK') atRiskCount += 1;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center">
        <Loader size={80} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Goals</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Plan and track your financial objectives
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4" />
          New Goal
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active Goals</p>
          <p className="mt-1 text-2xl font-bold text-primary">{activeGoals.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Saved</p>
          <p className="mt-1 text-2xl font-bold text-success">
            {formatCurrency(totalSaved, { hideSensitiveValues })}
          </p>
          <p className="text-xs text-muted-foreground">
            of {formatCurrency(totalTarget, { hideSensitiveValues })}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Required / month</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {formatCurrency(monthlyRequired, { hideSensitiveValues })}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">At Risk</p>
          <p className={`mt-1 text-2xl font-bold ${atRiskCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
            {atRiskCount}
          </p>
          {completedGoals.length > 0 && (
            <p className="text-xs text-muted-foreground">{completedGoals.length} completed</p>
          )}
        </div>
      </div>

      {/* Goal grid */}
      {visibleGoals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <p className="mt-4 font-semibold text-foreground">No goals yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first goal to start planning your savings, a trip, a purchase, or a debt payoff.
          </p>
          <Button className="mt-4" onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Goal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleGoals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}

      {/* Debt strategy comparison (shown with 2+ active debt goals) */}
      {activeGoals.filter((g) => g.type === 'DEBT_PAYOFF').length >= 2 && (
        <DebtStrategyPanel />
      )}

      <GoalForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmit}
        goal={null}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
