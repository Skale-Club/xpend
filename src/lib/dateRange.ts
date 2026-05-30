import { startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';

export type RangeId =
    | 'thisMonth'
    | 'lastMonth'
    | 'last3Months'
    | 'last6Months'
    | 'thisYear'
    | 'allTime'
    | 'custom';

export const RANGE_PRESETS: { id: Exclude<RangeId, 'custom'>; label: string }[] = [
    { id: 'thisMonth', label: 'This month' },
    { id: 'lastMonth', label: 'Last month' },
    { id: 'last3Months', label: 'Last 3 months' },
    { id: 'last6Months', label: 'Last 6 months' },
    { id: 'thisYear', label: 'This year' },
    { id: 'allTime', label: 'All time' },
];

export function computeRange(
    id: Exclude<RangeId, 'custom'>,
    now: Date = new Date()
): { from?: Date; to?: Date } {
    switch (id) {
        case 'thisMonth': return { from: startOfMonth(now), to: now };
        case 'lastMonth': { const d = subMonths(now, 1); return { from: startOfMonth(d), to: endOfMonth(d) }; }
        case 'last3Months': return { from: startOfMonth(subMonths(now, 2)), to: now };
        case 'last6Months': return { from: startOfMonth(subMonths(now, 5)), to: now };
        case 'thisYear': return { from: startOfYear(now), to: now };
        case 'allTime': return { from: undefined, to: undefined };
    }
}

// Number of calendar months a finite range spans (inclusive). Used to prorate
// the monthly budget so the progress bar compares like-for-like.
export function monthsInRange(from?: Date, to?: Date): number | null {
    if (!from || !to) return null;
    return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
}
