// Domain types for the Goals engine. These mirror the Prisma enums as string
// unions so they can be shared by client components without importing the
// generated Prisma client.

export type GoalType =
  | 'SAVINGS'
  | 'TRAVEL'
  | 'DEBT_PAYOFF'
  | 'PURCHASE'
  | 'EMERGENCY_FUND';

export type GoalStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ARCHIVED';

export type GoalPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type GoalPlanType = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'CUSTOM';

// Risk status is computed from progress + time remaining, never stored.
export type GoalRiskStatus =
  | 'COMPLETED'
  | 'ON_TRACK'
  | 'BEHIND'
  | 'AT_RISK'
  | 'NO_DEADLINE';

export interface Goal {
  id: string;
  name: string;
  type: GoalType;
  status: GoalStatus;
  priority: GoalPriority;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string | Date | null;
  startDate: string | Date;
  interestRate?: number | null;
  minimumPayment?: number | null;
  monthsOfCoverage?: number | null;
  metadata?: Record<string, unknown> | null;
  description?: string | null;
  aiSummary?: string | null;
  linkedAccountId?: string | null;
  linkedCategoryId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  linkedAccount?: { id: string; name: string; color: string } | null;
  linkedCategory?: { id: string; name: string; color: string } | null;
  contributions?: GoalContribution[];
  plans?: StoredGoalPlan[];
}

// A plan snapshot as stored in the database (JSON fields kept as raw strings).
export interface StoredGoalPlan {
  id: string;
  goalId: string;
  planType: GoalPlanType;
  monthlyTarget: number | null;
  weeklyTarget: number | null;
  dailyTarget: number | null;
  projectedCompletionDate: string | Date | null;
  assumptionsJson: string | null;
  recommendationsJson: string | null;
  createdBy: string;
  createdAt: string | Date;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  amount: number;
  date: string | Date;
  accountId?: string | null;
  transactionId?: string | null;
  note?: string | null;
  createdAt: string | Date;
  account?: { id: string; name: string; color: string } | null;
}

// Result of progress / savings-requirement calculations for a goal.
export interface GoalCalculation {
  amountRemaining: number;
  percentComplete: number; // 0–100, clamped
  monthsRemaining: number | null; // null when no target date
  daysRemaining: number | null;
  requiredMonthly: number | null;
  requiredWeekly: number | null;
  requiredDaily: number | null;
  isComplete: boolean;
}

// Real financial context assembled from existing Xpend data, passed to the AI
// planner. All figures are derived from stored transactions/subscriptions —
// never invented.
export interface GoalAiContext {
  hasData: boolean;
  monthsAnalyzed: number;
  avgMonthlyIncome: number;
  avgMonthlyExpenses: number;
  avgMonthlySurplus: number;
  monthlySubscriptionCost: number;
  estimatedTotalBalance: number;
  topExpenseCategories: { name: string; monthlyAvg: number }[];
  otherActiveGoals: { name: string; requiredMonthly: number | null }[];
}

// Deterministic numeric targets for a plan, computed by us (not the AI).
export interface PlanTargets {
  planType: GoalPlanType;
  monthlyTarget: number;
  weeklyTarget: number;
  dailyTarget: number;
  projectedCompletionDate: string | null;
  assumedHorizon: boolean; // true when no target date and a horizon was assumed
}

// A full AI-generated plan: our calculated numbers + the AI's narrative.
export interface GeneratedGoalPlan extends PlanTargets {
  summary: string;
  targetDateFeasibility: string;
  riskLevel: 'low' | 'medium' | 'high';
  assumptions: string[];
  recommendedSpendingChanges: string[];
  incomeIncreaseIdeas: string[];
  nextSteps: string[];
}

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  SAVINGS: 'Savings Goal',
  TRAVEL: 'Travel Goal',
  DEBT_PAYOFF: 'Debt Payoff Goal',
  PURCHASE: 'Purchase Goal',
  EMERGENCY_FUND: 'Emergency Fund Goal',
};

export const GOAL_TYPE_ICONS: Record<GoalType, string> = {
  SAVINGS: 'PiggyBank',
  TRAVEL: 'Plane',
  DEBT_PAYOFF: 'TrendingDown',
  PURCHASE: 'ShoppingBag',
  EMERGENCY_FUND: 'ShieldCheck',
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

export const GOAL_PRIORITY_LABELS: Record<GoalPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

export const GOAL_RISK_LABELS: Record<GoalRiskStatus, string> = {
  COMPLETED: 'Completed',
  ON_TRACK: 'On Track',
  BEHIND: 'Behind',
  AT_RISK: 'At Risk',
  NO_DEADLINE: 'No Deadline',
};
