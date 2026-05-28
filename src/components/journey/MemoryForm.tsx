'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button, Input, Select, Modal } from '@/components/ui';
import {
  MEMORY_TYPES,
  MEMORY_STATUSES,
  MEMORY_TYPE_LABELS,
  MEMORY_STATUS_LABELS,
  type FinancialMemory,
  type MemoryType,
} from '@/lib/memory/types';

export interface MemoryFormData {
  memoryType: MemoryType;
  title: string;
  content: string;
  status: string;
  confidence: string;
  priority: number;
  relatedEntityType: string;
  relatedEntityId: string;
}

interface MemoryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MemoryFormData) => void;
  memory?: FinancialMemory | null;
}

const TYPE_OPTIONS = MEMORY_TYPES.map((t) => ({ value: t, label: MEMORY_TYPE_LABELS[t] ?? t }));
const STATUS_OPTIONS = MEMORY_STATUSES.map((s) => ({ value: s, label: MEMORY_STATUS_LABELS[s] ?? s }));

function getInitial(memory?: FinancialMemory | null): MemoryFormData {
  if (memory) {
    return {
      memoryType: memory.memoryType as MemoryType,
      title: memory.title,
      content: memory.content,
      status: memory.status,
      confidence: memory.confidence != null ? String(memory.confidence) : '',
      priority: memory.priority ?? 0,
      relatedEntityType: memory.relatedEntityType || '',
      relatedEntityId: memory.relatedEntityId || '',
    };
  }
  return {
    memoryType: 'decision',
    title: '',
    content: '',
    status: 'active',
    confidence: '',
    priority: 0,
    relatedEntityType: '',
    relatedEntityId: '',
  };
}

export function MemoryForm({ isOpen, onClose, onSubmit, memory }: MemoryFormProps) {
  const initial = useMemo(() => getInitial(memory), [memory]);
  const [formData, setFormData] = useState<MemoryFormData>(initial);
  const [prevId, setPrevId] = useState<string | null | undefined>(memory?.id);

  if (memory?.id !== prevId) {
    setPrevId(memory?.id);
    setFormData(getInitial(memory));
  }

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    },
    [formData, onSubmit],
  );

  const handleClose = useCallback(() => {
    setFormData(getInitial(null));
    setPrevId(null);
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={memory ? 'Edit Memory' : 'New Memory'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Prioritize credit card debt before travel"
          required
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Content</label>
          <textarea
            className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            rows={3}
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="Describe the decision, assumption, risk, preference, or next step."
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select
            label="Type"
            value={formData.memoryType}
            onChange={(e) => setFormData({ ...formData, memoryType: e.target.value as MemoryType })}
            options={TYPE_OPTIONS}
          />
          <Select
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={STATUS_OPTIONS}
          />
          <Input
            label="Priority"
            type="number"
            step="1"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Confidence (0–1)"
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={formData.confidence}
            onChange={(e) => setFormData({ ...formData, confidence: e.target.value })}
            placeholder="Optional"
          />
          <Input
            label="Related Entity Type"
            value={formData.relatedEntityType}
            onChange={(e) => setFormData({ ...formData, relatedEntityType: e.target.value })}
            placeholder="e.g., goal"
          />
          <Input
            label="Related Entity ID"
            value={formData.relatedEntityId}
            onChange={(e) => setFormData({ ...formData, relatedEntityId: e.target.value })}
            placeholder="Optional"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">{memory ? 'Save Changes' : 'Create Memory'}</Button>
        </div>
      </form>
    </Modal>
  );
}
