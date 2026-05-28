'use client';

import { Pencil, Archive, X, Trash2, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import {
  MEMORY_TYPE_LABELS,
  MEMORY_STATUS_LABELS,
  MEMORY_SOURCE_LABELS,
  type FinancialMemory,
} from '@/lib/memory/types';
import { statusVariant, typeVariant } from './memoryDisplay';

interface MemoryCardProps {
  memory: FinancialMemory;
  onEdit: (memory: FinancialMemory) => void;
  onStatusChange: (memory: FinancialMemory, status: string) => void;
  onDelete: (memory: FinancialMemory) => void;
}

export function MemoryCard({ memory, onEdit, onStatusChange, onDelete }: MemoryCardProps) {
  const isRetired = memory.status === 'archived' || memory.status === 'superseded' || memory.status === 'rejected';

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={typeVariant(memory.memoryType)}>
            {MEMORY_TYPE_LABELS[memory.memoryType] ?? memory.memoryType}
          </Badge>
          <Badge variant={statusVariant(memory.status)}>
            {MEMORY_STATUS_LABELS[memory.status] ?? memory.status}
          </Badge>
          {memory.confidence != null && (
            <span className="text-[11px] text-muted-foreground">
              {Math.round(memory.confidence * 100)}% conf.
            </span>
          )}
        </div>
        <span className="flex-shrink-0 text-[11px] text-muted-foreground">
          {formatDate(memory.createdAt)}
        </span>
      </div>

      <p className={`mt-2 font-semibold ${isRetired ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
        {memory.title}
      </p>
      <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{memory.content}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>Source: {MEMORY_SOURCE_LABELS[memory.source] ?? memory.source}</span>
        {memory.relatedEntityType && memory.relatedEntityId && (
          <span className="inline-flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            {memory.relatedEntityType}
          </span>
        )}
        {memory.priority > 0 && <span>Priority {memory.priority}</span>}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-3">
        <ActionButton label="Edit" onClick={() => onEdit(memory)}>
          <Pencil className="h-3.5 w-3.5" />
        </ActionButton>
        {memory.status !== 'archived' && (
          <ActionButton label="Archive" onClick={() => onStatusChange(memory, 'archived')}>
            <Archive className="h-3.5 w-3.5" />
          </ActionButton>
        )}
        {memory.status !== 'rejected' && (
          <ActionButton label="Reject" onClick={() => onStatusChange(memory, 'rejected')}>
            <X className="h-3.5 w-3.5" />
          </ActionButton>
        )}
        <ActionButton label="Delete" danger onClick={() => onDelete(memory)}>
          <Trash2 className="h-3.5 w-3.5" />
        </ActionButton>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
        danger
          ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
