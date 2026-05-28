type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

// Badge variant for a memory lifecycle status.
export function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'active':
      return 'success';
    case 'needs_review':
      return 'warning';
    case 'rejected':
      return 'destructive';
    case 'superseded':
      return 'outline';
    case 'archived':
    default:
      return 'secondary';
  }
}

// Badge variant per memory type, to make the timeline scannable.
export function typeVariant(type: string): BadgeVariant {
  switch (type) {
    case 'decision':
      return 'default';
    case 'risk':
    case 'rejected_recommendation':
      return 'destructive';
    case 'assumption':
      return 'warning';
    case 'preference':
      return 'secondary';
    case 'next_step':
      return 'success';
    default:
      return 'outline';
  }
}
