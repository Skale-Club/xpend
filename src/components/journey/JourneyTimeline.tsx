'use client';

import { Badge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { MEMORY_TYPE_LABELS, MEMORY_SOURCE_LABELS, type JourneyEntry } from '@/lib/memory/types';
import { typeVariant } from './memoryDisplay';

interface JourneyTimelineProps {
  entries: JourneyEntry[];
}

// Chronological timeline of journey events (decisions, summaries, status updates…).
export function JourneyTimeline({ entries }: JourneyTimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
        No timeline events yet. Decisions, summaries, and updates will appear here as your journey grows.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[1.42rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={typeVariant(entry.entryType)}>
              {MEMORY_TYPE_LABELS[entry.entryType] ?? entry.entryType}
            </Badge>
            <span className="text-xs text-muted-foreground">{formatDate(entry.happenedAt)}</span>
            <span className="text-[11px] text-muted-foreground">
              · {MEMORY_SOURCE_LABELS[entry.source] ?? entry.source}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">{entry.title}</p>
          {entry.summary && <p className="text-sm text-muted-foreground">{entry.summary}</p>}
          {entry.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {entry.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
