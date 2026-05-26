'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalCount,
  pageSize,
  onPageChange,
  className,
}: PaginationProps) {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  const startRange = (currentPage - 1) * pageSize + 1;
  const endRange = Math.min(currentPage * pageSize, totalCount);

  const btnBase =
    'inline-flex items-center justify-center h-8 min-w-8 px-2 border border-border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      {/* Mobile */}
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(btnBase, 'rounded-lg bg-card text-foreground hover:bg-muted')}
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(btnBase, 'rounded-lg bg-card text-foreground hover:bg-muted')}
        >
          Next
        </button>
      </div>

      {/* Desktop */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{startRange}</span> –{' '}
          <span className="font-medium text-foreground">{endRange}</span> of{' '}
          <span className="font-medium text-foreground">{totalCount}</span>
        </p>

        <nav className="inline-flex -space-x-px rounded-lg overflow-hidden shadow-sm" aria-label="Pagination">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={cn(btnBase, 'rounded-l-lg bg-card text-muted-foreground hover:bg-muted')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {[...Array(totalPages)].map((_, i) => {
            const p = i + 1;
            if (
              p === 1 || p === totalPages ||
              (p >= currentPage - 1 && p <= currentPage + 1)
            ) {
              return (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={cn(
                    btnBase,
                    currentPage === p
                      ? 'bg-primary text-primary-foreground border-primary z-10'
                      : 'bg-card text-foreground hover:bg-muted',
                  )}
                >
                  {p}
                </button>
              );
            }
            if (p === currentPage - 2 || p === currentPage + 2) {
              return (
                <span key={p} className={cn(btnBase, 'bg-card text-muted-foreground cursor-default')}>
                  …
                </span>
              );
            }
            return null;
          })}

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={cn(btnBase, 'rounded-r-lg bg-card text-muted-foreground hover:bg-muted')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </div>
  );
}
