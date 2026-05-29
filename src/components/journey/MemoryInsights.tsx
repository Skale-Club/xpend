'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, GitMerge, AlertTriangle, Clock, Sparkles } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { MEMORY_TYPE_LABELS } from '@/lib/memory/types';

interface PairFinding {
  kind: 'duplicate' | 'conflict';
  reason: string;
  newer: { id: string; title: string };
  older: { id: string; title: string };
}

interface HealthResponse {
  report: {
    active: number;
    needsReview: number;
    duplicates: number;
    conflicts: number;
    stale: number;
  };
  contradictions: PairFinding[];
  supersedeSuggestions: PairFinding[];
  stale: { id: string; title: string; reason: string }[];
  changesSinceLastPlan: {
    since: string | null;
    newMemories: { id: string; memoryType: string; title: string; createdAt: string }[];
  };
}

interface MemoryInsightsProps {
  reloadKey: number;
  onChange: () => void;
}

export function MemoryInsights({ reloadKey, onChange }: MemoryInsightsProps) {
  const toast = useToast();
  const [data, setData] = useState<HealthResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/memories/health');
      if (!res.ok) return;
      setData(await res.json());
    } catch (error) {
      console.error('Failed to load memory insights:', error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const supersede = useCallback(
    async (finding: PairFinding) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/memories/${finding.older.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supersededById: finding.newer.id, status: 'superseded' }),
        });
        if (!res.ok) throw new Error('Failed to supersede memory');
        toast.success('Older memory superseded');
        onChange();
      } catch (error) {
        console.error('Failed to supersede:', error);
        toast.error('Failed to supersede memory');
      } finally {
        setBusy(false);
      }
    },
    [toast, onChange],
  );

  const archive = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/memories/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'archived' }),
        });
        if (!res.ok) throw new Error('Failed to archive memory');
        toast.success('Memory archived');
        onChange();
      } catch (error) {
        console.error('Failed to archive:', error);
        toast.error('Failed to archive memory');
      } finally {
        setBusy(false);
      }
    },
    [toast, onChange],
  );

  if (!data) return null;

  const { report, contradictions, supersedeSuggestions, stale, changesSinceLastPlan } = data;
  const nothingToShow =
    contradictions.length === 0 &&
    supersedeSuggestions.length === 0 &&
    stale.length === 0 &&
    changesSinceLastPlan.newMemories.length === 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Activity className="h-4 w-4 text-primary" />
        Memory Health & Insights
      </p>

      <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>{report.active} active</span>
        <span>{report.duplicates} possible duplicates</span>
        <span>{report.conflicts} possible conflicts</span>
        <span>{report.stale} stale</span>
        <span>{report.needsReview} needs review</span>
      </div>

      {nothingToShow && (
        <p className="text-sm text-muted-foreground">
          No issues detected. Your memories look healthy and consistent.
        </p>
      )}

      {/* Supersede suggestions */}
      {supersedeSuggestions.length > 0 && (
        <Section icon={<GitMerge className="h-4 w-4 text-warning" />} title="Suggested supersedes">
          {supersedeSuggestions.map((f, i) => (
            <li key={i} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-foreground">{f.reason}</p>
                <p className="text-xs text-muted-foreground">
                  Keep: <span className="font-medium text-foreground">{f.newer.title}</span> · Supersede:{' '}
                  {f.older.title}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => supersede(f)}>
                Supersede older
              </Button>
            </li>
          ))}
        </Section>
      )}

      {/* Conflicts */}
      {contradictions.length > 0 && (
        <Section icon={<AlertTriangle className="h-4 w-4 text-destructive" />} title="Possible conflicts">
          {contradictions.map((f, i) => (
            <li key={i} className="py-2">
              <p className="text-sm text-foreground">{f.reason}</p>
              <p className="text-xs text-muted-foreground">
                {f.newer.title} ↔ {f.older.title}
              </p>
            </li>
          ))}
        </Section>
      )}

      {/* Stale */}
      {stale.length > 0 && (
        <Section icon={<Clock className="h-4 w-4 text-warning" />} title="Stale memories">
          {stale.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.reason}</p>
              </div>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => archive(s.id)}>
                Archive
              </Button>
            </li>
          ))}
        </Section>
      )}

      {/* Changes since last plan */}
      {changesSinceLastPlan.newMemories.length > 0 && (
        <Section icon={<Sparkles className="h-4 w-4 text-primary" />} title="What changed since your last plan">
          {changesSinceLastPlan.newMemories.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-sm text-foreground">
                <span className="text-xs text-muted-foreground">{MEMORY_TYPE_LABELS[m.memoryType] ?? m.memoryType}:</span>{' '}
                {m.title}
              </span>
              <span className="flex-shrink-0 text-xs text-muted-foreground">{formatDate(m.createdAt)}</span>
            </li>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border-t border-border pt-3 first:mt-0 first:border-t-0 first:pt-0">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </p>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}
