'use client';

import { useState, useCallback } from 'react';
import { Check, X, Inbox } from 'lucide-react';
import { Badge, useToast } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { MEMORY_TYPE_LABELS, type MemoryReviewItem } from '@/lib/memory/types';
import { typeVariant } from './memoryDisplay';

interface MemoryReviewQueueProps {
  items: MemoryReviewItem[];
  onChange: () => void;
}

export function MemoryReviewQueue({ items, onChange }: MemoryReviewQueueProps) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const act = useCallback(
    async (item: MemoryReviewItem, action: 'approve' | 'reject') => {
      setBusyId(item.id);
      try {
        const res = await fetch(`/api/memories/review-queue/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update review item');
        }
        toast.success(action === 'approve' ? 'Memory approved & saved' : 'Candidate rejected');
        onChange();
      } catch (error) {
        console.error('Failed to update review item:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to update review item');
      } finally {
        setBusyId(null);
      }
    },
    [toast, onChange],
  );

  const pending = items.filter((i) => i.status === 'pending');
  if (pending.length === 0) return null;

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-5 shadow-sm">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Inbox className="h-4 w-4 text-warning" />
        Memories to Review ({pending.length})
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Candidates extracted from your conversations. Approve to keep them as durable memories, or reject.
      </p>

      <ul className="space-y-2">
        {pending.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={typeVariant(item.proposedMemoryType)}>
                  {MEMORY_TYPE_LABELS[item.proposedMemoryType] ?? item.proposedMemoryType}
                </Badge>
                {item.confidence != null && (
                  <span className="text-[11px] text-muted-foreground">
                    {Math.round(item.confidence * 100)}% conf.
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">· {formatDate(item.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.content}</p>
            </div>
            <div className="flex flex-shrink-0 gap-1">
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => act(item, 'approve')}
                title="Approve"
                aria-label="Approve"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-success/10 hover:text-success disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => act(item, 'reject')}
                title="Reject"
                aria-label="Reject"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
