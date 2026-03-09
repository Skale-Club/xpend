'use client';

import { useEffect } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Info, RotateCcw } from 'lucide-react';

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
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-600" />,
    error: <XCircle className="w-5 h-5 text-red-600" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-600" />,
    info: <Info className="w-5 h-5 text-blue-600" />,
  };

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const handleRetry = () => {
    if (toast.onRetry) {
      toast.onRetry();
      onClose(toast.id);
    }
  };

  const handleAction = () => {
    if (toast.action) {
      toast.action.onClick();
      onClose(toast.id);
    }
  };

  return (
    <div
      className={`flex items-center gap-3 min-w-80 max-w-md p-4 rounded-lg border shadow-lg animate-slide-in ${styles[toast.type]}`}
    >
      {icons[toast.type]}
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <div className="flex items-center gap-1">
        {toast.showRetry && toast.onRetry && (
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium hover:bg-black/10 rounded transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Retry
          </button>
        )}
        {toast.action && (
          <button
            onClick={handleAction}
            className="px-2 py-1 text-xs font-medium hover:bg-black/10 rounded transition-colors"
          >
            {toast.action.label}
          </button>
        )}
        <button
          onClick={() => onClose(toast.id)}
          className="p-1 hover:bg-black/5 rounded transition-colors"
        >
          <X className="w-4 h-4" />
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
