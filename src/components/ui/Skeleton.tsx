'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
    return (
        <div
            style={style}
            className={cn(
                'animate-pulse bg-gray-200 rounded-md',
                className
            )}
        />
    );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
    return (
        <div className={cn('space-y-2', className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={cn(
                        'h-4',
                        i === lines - 1 ? 'w-3/4' : 'w-full'
                    )}
                />
            ))}
        </div>
    );
}

export function SkeletonCard({ className }: { className?: string }) {
    return (
        <div className={cn('bg-white rounded-xl p-6 shadow-sm border border-gray-100', className)}>
            <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-20" />
        </div>
    );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
    return (
        <div className="w-full">
            {/* Header */}
            <div className="flex gap-4 p-4 border-b border-gray-200">
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} className="h-4 flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex gap-4 p-4 border-b border-gray-100">
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <Skeleton
                            key={colIndex}
                            className={cn(
                                'h-4 flex-1',
                                colIndex === 0 ? 'w-32' : '',
                                colIndex === columns - 1 ? 'w-20' : ''
                            )}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function SkeletonChart({ className }: { className?: string }) {
    const heights = ['65%', '80%', '45%', '90%', '70%', '55%', '75%'];
    return (
        <div className={cn('w-full h-64 flex items-end justify-around gap-2 p-4', className)}>
            {heights.map((height, i) => (
                <Skeleton
                    key={i}
                    className="w-full rounded-t-md"
                    style={{ height }}
                />
            ))}
        </div>
    );
}

export function SkeletonList({ items = 5 }: { items?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: items }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                </div>
            ))}
        </div>
    );
}
