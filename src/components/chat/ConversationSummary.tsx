'use client';

import Link from 'next/link';
import { X } from 'lucide-react';

export interface ConversationSummaryData {
  title: string;
  summary: string;
  situation?: string;
  decisions: string[];
  assumptions: string[];
  risks: string[];
  preferences: string[];
  nextSteps: string[];
  openQuestions?: string[];
}

interface ConversationSummaryProps {
  summary: ConversationSummaryData;
  extractedCount?: number | null;
  onDismiss?: () => void;
}

function Group({ label, items }: { label: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="mt-0.5 space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-foreground">• {item}</li>
        ))}
      </ul>
    </div>
  );
}

// Compact view of a saved conversation summary, shown after summarizing a chat.
export function ConversationSummary({ summary, extractedCount, onDismiss }: ConversationSummaryProps) {
  return (
    <div className="border-t border-border bg-muted/40 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-foreground">{summary.title}</p>
        {onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{summary.summary}</p>

      <div className="max-h-40 overflow-y-auto">
        <Group label="Decisions" items={summary.decisions} />
        <Group label="Assumptions" items={summary.assumptions} />
        <Group label="Risks" items={summary.risks} />
        <Group label="Preferences" items={summary.preferences} />
        <Group label="Next steps" items={summary.nextSteps} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {extractedCount != null && extractedCount > 0
            ? `${extractedCount} memory candidate(s) sent to review`
            : 'Summary saved to your journey'}
        </span>
        <Link href="/journey" className="font-medium text-primary hover:underline">
          Open Journey →
        </Link>
      </div>
    </div>
  );
}
