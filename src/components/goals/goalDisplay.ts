import type { GoalRiskStatus } from '@/lib/goals/types';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

// Map a computed risk status to a Badge variant + bar color for consistent
// display across the goals list and detail views.
export function riskBadgeVariant(risk: GoalRiskStatus): BadgeVariant {
  switch (risk) {
    case 'COMPLETED':
      return 'success';
    case 'ON_TRACK':
      return 'success';
    case 'BEHIND':
      return 'warning';
    case 'AT_RISK':
      return 'destructive';
    case 'NO_DEADLINE':
    default:
      return 'secondary';
  }
}

// Tailwind background class for the progress bar fill, keyed on risk.
export function progressBarColor(risk: GoalRiskStatus): string {
  switch (risk) {
    case 'COMPLETED':
    case 'ON_TRACK':
      return 'bg-success';
    case 'BEHIND':
      return 'bg-warning';
    case 'AT_RISK':
      return 'bg-destructive';
    default:
      return 'bg-primary';
  }
}
