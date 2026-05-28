'use client';

import { useState, useCallback } from 'react';
import { Pencil, Compass } from 'lucide-react';
import { Button, Input, Modal, useToast } from '@/components/ui';
import type { FinancialJourney } from '@/lib/memory/types';

interface JourneySummaryProps {
  journey: FinancialJourney;
  onUpdated: () => void;
}

export function JourneySummary({ journey, onUpdated }: JourneySummaryProps) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(journey.title);
  const [summary, setSummary] = useState(journey.summary || '');
  const [currentFocus, setCurrentFocus] = useState(journey.currentFocus || '');

  const open = useCallback(() => {
    setTitle(journey.title);
    setSummary(journey.summary || '');
    setCurrentFocus(journey.currentFocus || '');
    setIsEditing(true);
  }, [journey]);

  const save = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const res = await fetch('/api/journey', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, summary, currentFocus }),
        });
        if (!res.ok) throw new Error('Failed to update journey');
        toast.success('Journey updated');
        setIsEditing(false);
        onUpdated();
      } catch (error) {
        console.error('Failed to update journey:', error);
        toast.error('Failed to update journey');
      }
    },
    [title, summary, currentFocus, toast, onUpdated],
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">{journey.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {journey.summary || 'No summary yet. Add an overview of your financial direction.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={open}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </div>

      {journey.currentFocus && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <Compass className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Current focus</p>
            <p className="text-sm text-foreground">{journey.currentFocus}</p>
          </div>
        </div>
      )}

      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Edit Journey" size="lg">
        <form onSubmit={save} className="space-y-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Summary</label>
            <textarea
              className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Overview of your financial direction"
            />
          </div>
          <Input
            label="Current Focus"
            value={currentFocus}
            onChange={(e) => setCurrentFocus(e.target.value)}
            placeholder="e.g., Pay down credit card debt, then save for August trip"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
