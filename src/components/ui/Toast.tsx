'use client';

import { useEffect } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Info, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: ToastAction;
  showRetry?: boolean;
  onRetry?: () => void;
}

interface ToastItemProps {
  toast: Toast;
  onClose: (id: string) => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.id), toast.duration ?? 5000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const icons = {
    success: <CheckCircle className="h-4 w-4 text-success" />,
    error:   <XCircle    className="h-4 w-4 text-destructive" />,
    warning: <AlertCircle className="h-4 w-4 text-warning" />,
    info:    <Info        className="h-4 w-4 text-primary" />,
  };

  const styles = {
    success: 'border-success/20 bg-success/5 text-foreground',
    error:   'border-destructive/20 bg-destructive/5 text-foreground',
    warning: 'border-warning/20 bg-warning/5 text-foreground',
    info:    'border-primary/20 bg-primary/5 text-foreground',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 min-w-80 max-w-md rounded-xl border bg-card px-4 py-3 shadow-lg animate-slide-in',
        styles[toast.type],
      )}
    >
      <span className="flex-shrink-0">{icons[toast.type]}</span>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <div className="flex items-center gap-1">
        {toast.showRetry && toast.onRetry && (
          <button
            onClick={() => { toast.onRetry?.(); onClose(toast.id); }}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:bg-muted transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Retry
          </button>
        )}
        {toast.action && (
          <button
            onClick={() => { toast.action?.onClick(); onClose(toast.id); }}
            className="rounded px-2 py-1 text-xs font-medium hover:bg-muted transition-colors"
          >
            {toast.action.label}
          </button>
        )}
        <button
          onClick={() => onClose(toast.id)}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}
