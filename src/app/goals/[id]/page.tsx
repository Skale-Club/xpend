'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import {
  GoalForm,
  GoalFormData,
  GoalProgress,
  GoalContributionList,
  GoalAiPlanner,
  GoalPlanCard,
  GoalScenarioList,
  GoalDebtPayoff,
  normalizeStoredPlan,
  riskBadgeVariant,
} from '@/components/goals';
import { Button, Badge, Loader, useToast, Card, CardContent } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import { computeGoalProgress } from '@/lib/goals/calculations';
import { computeRiskStatus } from '@/lib/goals/status';
import { readArrayResponse } from '@/lib/http';
import {
  GOAL_TYPE_LABELS,
  GOAL_STATUS_LABELS,
  GOAL_PRIORITY_LABELS,
  GOAL_RISK_LABELS,
  type Goal,
} from '@/lib/goals/types';

interface AccountOption { id: string; name: string }
interface CategoryOption { id: string; name: string }

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const goalId = params.id as string;
  const toast = useToast();
  const { hideSensitiveValues } = useSensitiveValues();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchGoal = useCallback(async () => {
    setIsLoading(true);
    try {
      const [goalRes, accountsRes, categoriesRes] = await Promise.all([
        fetch(`/api/goals/${goalId}`),
        fetch('/api/accounts'),
        fetch('/api/categories'),
      ]);
      if (!goalRes.ok) {
        toast.error('Goal not found');
        router.push('/goals');
        return;
      }
      setGoal(await goalRes.json());
      setAccounts(await readArrayResponse<AccountOption>(accountsRes, 'Accounts'));
      setCategories(await readArrayResponse<CategoryOption>(categoriesRes, 'Categories'));
    } catch (error) {
      console.error('Failed to fetch goal:', error);
      toast.error('Failed to load goal');
    } finally {
      setIsLoading(false);
    }
  }, [goalId, router, toast]);

  useEffect(() => {
    fetchGoal();
  }, [fetchGoal]);

  const handleUpdate = useCallback(
    async (data: GoalFormData) => {
      try {
        const res = await fetch(`/api/goals/${goalId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to update goal');
        }
        toast.success('Goal updated successfully');
        setIsFormOpen(false);
        fetchGoal();
      } catch (error) {
        console.error('Failed to update goal:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to update goal');
      }
    },
    [goalId, toast, fetchGoal],
  );

  const handleDeletePlan = useCallback(
    async (planId: string) => {
      if (!window.confirm('Remove this saved plan?')) return;
      try {
        const res = await fetch(`/api/goals/${goalId}/plans/${planId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to remove plan');
        toast.success('Plan removed');
        fetchGoal();
      } catch (error) {
        console.error('Failed to remove plan:', error);
        toast.error('Failed to remove plan');
      }
    },
    [goalId, toast, fetchGoal],
  );

  const handleDelete = useCallback(async () => {
    if (!window.confirm('Delete this goal? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/goals/${goalId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete goal');
      toast.success('Goal deleted');
      router.push('/goals');
    } catch (error) {
      console.error('Failed to delete goal:', error);
      toast.error('Failed to delete goal');
    }
  }, [goalId, router, toast]);

  if (isLoading || !goal) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center">
        <Loader size={80} />
      </div>
    );
  }

  const calc = computeGoalProgress(goal);
  const risk = computeRiskStatus(goal, calc);

  const requirementRows: { label: string; value: number | null }[] = [
    { label: 'Required / month', value: calc.requiredMonthly },
    { label: 'Required / week', value: calc.requiredWeekly },
    { label: 'Required / day', value: calc.requiredDaily },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <button
        onClick={() => router.push('/goals')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Goals
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{goal.name}</h1>
            <Badge variant={riskBadgeVariant(risk)}>{GOAL_RISK_LABELS[risk]}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {GOAL_TYPE_LABELS[goal.type]} · {GOAL_STATUS_LABELS[goal.status]} ·{' '}
            {GOAL_PRIORITY_LABELS[goal.priority]} priority
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsFormOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Overview */}
        <Card className="lg:col-span-2">
          <CardContent className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Progress</p>
              <GoalProgress
                current={goal.currentAmount}
                target={goal.targetAmount}
                calc={calc}
                risk={risk}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
              <Stat label="Target" value={formatCurrency(goal.targetAmount, { hideSensitiveValues })} />
              <Stat label="Saved" value={formatCurrency(goal.currentAmount, { hideSensitiveValues })} />
              <Stat label="Remaining" value={formatCurrency(calc.amountRemaining, { hideSensitiveValues })} />
              <Stat
                label="Deadline"
                value={goal.targetDate ? formatDate(goal.targetDate) : 'None'}
              />
            </div>

            {goal.description && (
              <div className="border-t border-border pt-4">
                <p className="mb-1 text-sm font-semibold text-foreground">Description</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{goal.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Required savings */}
        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm font-semibold text-foreground">Savings Required</p>
            {goal.targetDate ? (
              <div className="space-y-3">
                {requirementRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="text-sm font-bold text-foreground">
                      {row.value == null
                        ? '—'
                        : formatCurrency(row.value, { hideSensitiveValues })}
                    </span>
                  </div>
                ))}
                {calc.daysRemaining != null && (
                  <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                    {calc.daysRemaining} days remaining
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Set a target date to calculate the savings required to reach this goal on time.
              </p>
            )}

            {(goal.linkedAccount || goal.linkedCategory) && (
              <div className="space-y-2 border-t border-border pt-4">
                {goal.linkedAccount && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Account</span>
                    <span className="font-medium text-foreground">{goal.linkedAccount.name}</span>
                  </div>
                )}
                {goal.linkedCategory && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium text-foreground">{goal.linkedCategory.name}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Debt payoff (debt goals only) */}
      {goal.type === 'DEBT_PAYOFF' && (
        <Card>
          <CardContent>
            <GoalDebtPayoff goal={goal} />
          </CardContent>
        </Card>
      )}

      {/* AI Planner */}
      <Card>
        <CardContent>
          <GoalAiPlanner goalId={goal.id} onSaved={fetchGoal} />
        </CardContent>
      </Card>

      {/* Saved plans */}
      {goal.plans && goal.plans.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold text-foreground">Saved Plans</p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {goal.plans.map((plan) => (
              <GoalPlanCard
                key={plan.id}
                plan={normalizeStoredPlan(plan)}
                createdAt={plan.createdAt}
                footer={
                  <Button size="sm" variant="ghost" onClick={() => handleDeletePlan(plan.id)}>
                    Remove
                  </Button>
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Scenarios */}
      <Card>
        <CardContent>
          <GoalScenarioList
            goal={goal}
            scenarios={goal.scenarios ?? []}
            categories={categories}
            onChange={fetchGoal}
          />
        </CardContent>
      </Card>

      {/* Contributions */}
      <Card>
        <CardContent>
          <GoalContributionList
            goalId={goal.id}
            contributions={goal.contributions ?? []}
            accounts={accounts}
            onChange={fetchGoal}
          />
        </CardContent>
      </Card>

      <GoalForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleUpdate}
        goal={goal}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
