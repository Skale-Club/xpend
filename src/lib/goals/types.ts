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
