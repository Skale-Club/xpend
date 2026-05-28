'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import type { GeneratedGoalPlan, GoalAiContext } from '@/lib/goals/types';
import { GoalPlanCard } from './GoalPlanCard';

interface GoalAiPlannerProps {
  goalId: string;
  onSaved: () => void;
}

export function GoalAiPlanner({ goalId, onSaved }: GoalAiPlannerProps) {
  const toast = useToast();
  const { hideSensitiveValues } = useSensitiveValues();
  const [isGenerating, setIsGenerating] = useState(false);
  const [plans, setPlans] = useState<GeneratedGoalPlan[] | null>(null);
  const [context, setContext] = useState<GoalAiContext | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [savingType, setSavingType] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setNotConfigured(false);
    try {
      const res = await fetch(`/api/goals/${goalId}/ai-plan`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400) {
          setNotConfigured(true);
          return;
        }
        throw new Error(data.error || 'Failed to generate plan');
      }
      setPlans(data.plans);
      setContext(data.context);
    } catch (error) {
      console.error('Failed to generate AI plan:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate AI plan');
    } finally {
      setIsGenerating(false);
    }
  }, [goalId, toast]);

  const savePlan = useCallback(
    async (plan: GeneratedGoalPlan) => {
      setSavingType(plan.planType);
      try {
        const res = await fetch(`/api/goals/${goalId}/plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(plan),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to save plan');
        }
        toast.success('Plan saved');
        onSaved();
      } catch (error) {
        console.error('Failed to save plan:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to save plan');
      } finally {
        setSavingType(null);
      }
    },
    [goalId, toast, onSaved],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Goal Planner
          </p>
          <p className="text-xs text-muted-foreground">
            Generates conservative, balanced, and aggressive plans from your real Xpend data.
          </p>
        </div>
        <Button onClick={generate} isLoading={isGenerating} variant={plans ? 'outline' : 'primary'}>
          {plans ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {plans ? 'Regenerate' : 'Generate AI Plan'}
        </Button>
      </div>

      {notConfigured && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-foreground">
          AI is not configured. Add an OpenRouter API key in{' '}
          <Link href="/settings" className="font-medium text-primary underline">
            Settings
          </Link>{' '}
          to generate plans.
        </div>
      )}

      {context && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {context.hasData ? (
            <span>
              Based on {context.monthsAnalyzed} month(s) of data · avg surplus{' '}
              <span className="font-medium text-foreground">
                {formatCurrency(context.avgMonthlySurplus, { hideSensitiveValues })}
              </span>
              /mo · subscriptions{' '}
              {formatCurrency(context.monthlySubscriptionCost, { hideSensitiveValues })}/mo
            </span>
          ) : (
            <span>No transaction history found — plans assume income/expenses are unknown.</span>
          )}
        </div>
      )}

      {plans && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <GoalPlanCard
              key={plan.planType}
              plan={plan}
              footer={
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={savingType === plan.planType}
                  onClick={() => savePlan(plan)}
                >
                  Save plan
                </Button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
