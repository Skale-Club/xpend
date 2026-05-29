'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Brain } from 'lucide-react';
import {
  JourneySummary,
  MemoryCard,
  MemoryForm,
  MemoryFormData,
  NextStepsPanel,
  JourneyTimeline,
  MemoryReviewQueue,
  MemoryInsights,
} from '@/components/journey';
import { useToast, Loader, Button, Select } from '@/components/ui';
import {
  MEMORY_TYPES,
  MEMORY_STATUSES,
  MEMORY_TYPE_LABELS,
  MEMORY_STATUS_LABELS,
  type FinancialJourney,
  type FinancialMemory,
  type JourneyEntry,
  type MemoryReviewItem,
} from '@/lib/memory/types';

export default function JourneyPage() {
  const toast = useToast();
  const [journey, setJourney] = useState<FinancialJourney | null>(null);
  const [entries, setEntries] = useState<JourneyEntry[]>([]);
  const [memories, setMemories] = useState<FinancialMemory[]>([]);
  const [reviewItems, setReviewItems] = useState<MemoryReviewItem[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialMemory | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [journeyRes, memoriesRes, reviewRes] = await Promise.all([
        fetch('/api/journey'),
        fetch('/api/memories'),
        fetch('/api/memories/review-queue'),
      ]);
      const journeyData = await journeyRes.json();
      setJourney(journeyData);
      setEntries(journeyData.entries || []);
      setMemories(await memoriesRes.json());
      setReviewItems(await reviewRes.json());
      setReloadKey((k) => k + 1);
    } catch (error) {
      console.error('Failed to load journey:', error);
      toast.error('Failed to load financial journey');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSubmit = useCallback(
    async (data: MemoryFormData) => {
      try {
        const res = editing
          ? await fetch(`/api/memories/${editing.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            })
          : await fetch('/api/memories', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to save memory');
        }
        toast.success(editing ? 'Memory updated' : 'Memory created');
        setIsFormOpen(false);
        setEditing(null);
        fetchAll();
      } catch (error) {
        console.error('Failed to save memory:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to save memory');
      }
    },
    [editing, toast, fetchAll],
  );

  const handleStatusChange = useCallback(
    async (memory: FinancialMemory, status: string) => {
      try {
        const res = await fetch(`/api/memories/${memory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update memory');
        }
        fetchAll();
      } catch (error) {
        console.error('Failed to update memory:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to update memory');
      }
    },
    [toast, fetchAll],
  );

  const handleDelete = useCallback(
    async (memory: FinancialMemory) => {
      if (!window.confirm('Delete this memory permanently? Consider archiving instead.')) return;
      try {
        const res = await fetch(`/api/memories/${memory.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete memory');
        toast.success('Memory deleted');
        fetchAll();
      } catch (error) {
        console.error('Failed to delete memory:', error);
        toast.error('Failed to delete memory');
      }
    },
    [toast, fetchAll],
  );

  const openCreate = () => {
    setEditing(null);
    setIsFormOpen(true);
  };
  const openEdit = (memory: FinancialMemory) => {
    setEditing(memory);
    setIsFormOpen(true);
  };

  const filteredMemories = memories.filter(
    (m) => (!typeFilter || m.memoryType === typeFilter) && (!statusFilter || m.status === statusFilter),
  );

  const activeCount = memories.filter((m) => m.status === 'active').length;
  const needsReviewCount = memories.filter((m) => m.status === 'needs_review').length;
  const openNextSteps = memories.filter((m) => m.memoryType === 'next_step' && m.status === 'active').length;
  const decisions = memories.filter((m) => m.memoryType === 'decision' && m.status === 'active').length;

  if (isLoading || !journey) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center">
        <Loader size={80} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
            <Brain className="h-5 w-5 text-primary" />
            Financial Journey
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Durable memory of your decisions, assumptions, plans, and next steps
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Memory
        </Button>
      </div>

      <JourneySummary journey={journey} onUpdated={fetchAll} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Active memories" value={activeCount} />
        <Stat label="Decisions" value={decisions} />
        <Stat label="Open next steps" value={openNextSteps} />
        <Stat label="Needs review" value={needsReviewCount} highlight={needsReviewCount > 0} />
      </div>

      <MemoryReviewQueue items={reviewItems} onChange={fetchAll} />

      <NextStepsPanel memories={memories} onComplete={(m) => handleStatusChange(m, 'archived')} />

      <MemoryInsights reloadKey={reloadKey} onChange={fetchAll} />

      {/* Memories */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">Memories</p>
          <div className="flex gap-2">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: '', label: 'All types' },
                ...MEMORY_TYPES.map((t) => ({ value: t, label: MEMORY_TYPE_LABELS[t] ?? t })),
              ]}
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All statuses' },
                ...MEMORY_STATUSES.map((s) => ({ value: s, label: MEMORY_STATUS_LABELS[s] ?? s })),
              ]}
            />
          </div>
        </div>

        {filteredMemories.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            No memories match these filters. Create one to start building your financial journey.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredMemories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onEdit={openEdit}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Timeline</p>
        <JourneyTimeline entries={entries} />
      </div>

      <MemoryForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        memory={editing}
      />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? 'text-warning' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
