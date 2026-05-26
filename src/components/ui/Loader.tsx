'use client';

import { cn } from '@/lib/utils';

interface LoaderProps {
  size?: number;
  className?: string;
}

export function Loader({ size = 120, className = '' }: LoaderProps) {
    const borderWidth = Math.max(2, Math.round(size / 16));

    return (
        <div className={cn('flex items-center justify-center', className)} aria-label="Loading" role="status">
            <div
                className="animate-spin rounded-full border-blue-100 border-t-blue-600"
                style={{
                    width: size,
                    height: size,
                    borderWidth,
                }}
            />
        </div>
    );
}

export function LoaderOverlay({ size = 120 }: { size?: number }) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <Loader size={size} />
    </div>
  );
}

export function LoaderInline({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader size={size} />
    </div>
  );
}
