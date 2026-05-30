'use client';

import { Calendar } from 'lucide-react';
import { endOfDay } from 'date-fns';
import { RANGE_PRESETS, type RangeId } from '@/lib/dateRange';

interface PeriodRangeFilterProps {
    rangeId: RangeId;
    customRange: { from?: Date; to?: Date };
    onRangeChange: (rangeId: RangeId, customRange: { from?: Date; to?: Date }) => void;
    className?: string;
}

export function PeriodRangeFilter({
    rangeId,
    customRange,
    onRangeChange,
    className,
}: PeriodRangeFilterProps) {
    return (
        <div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`}>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mr-1">
                <Calendar className="w-3.5 h-3.5" />
                Period
            </div>
            {RANGE_PRESETS.map(({ id, label }) => {
                const isActive = rangeId === id;
                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onRangeChange(id, customRange)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${isActive
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {label}
                    </button>
                );
            })}
            <div className="flex items-center gap-1.5 ml-auto">
                <input
                    type="date"
                    value={customRange.from ? customRange.from.toISOString().split('T')[0] : ''}
                    onChange={(e) =>
                        onRangeChange('custom', {
                            ...customRange,
                            from: e.target.value ? new Date(e.target.value) : undefined,
                        })
                    }
                    className="px-2.5 py-1.5 text-xs border border-border rounded-lg bg-card text-foreground [color-scheme:light] dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
                <span className="text-muted-foreground/50 text-xs">—</span>
                <input
                    type="date"
                    value={customRange.to ? customRange.to.toISOString().split('T')[0] : ''}
                    onChange={(e) =>
                        onRangeChange('custom', {
                            ...customRange,
                            to: e.target.value ? endOfDay(new Date(e.target.value)) : undefined,
                        })
                    }
                    className="px-2.5 py-1.5 text-xs border border-border rounded-lg bg-card text-foreground [color-scheme:light] dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
            </div>
        </div>
    );
}
