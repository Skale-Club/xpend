'use client';

import { CheckCircle2, ListChecks } from 'lucide-react';
import type { FinancialMemory } from '@/lib/memory/types';

interface NextStepsPanelProps {
  memories: FinancialMemory[];
  onComplete: (memory: FinancialMemory) => void;
}

// Surfaces active "next_step" memories as an actionable checklist.
export function NextStepsPanel({ memories, onComplete }: NextStepsPanelProps) {
  const openSteps = memories.filter((m) => m.memoryType === 'next_step' && m.status === 'active');

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <ListChecks className="h-4 w-4 text-primary" />
        Open Next Steps
      </p>

      {openSteps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open next steps. You&apos;re all caught up.</p>
      ) : (
        <ul className="space-y-2">
          {openSteps.map((step) => (
            <li key={step.id} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => onComplete(step)}
                title="Mark as done (archive)"
                aria-label="Mark as done"
                className="mt-0.5 text-muted-foreground transition-colors hover:text-success"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
              <div>
                <p className="text-sm font-medium text-foreground">{step.title}</p>
                {step.content && <p className="text-xs text-muted-foreground">{step.content}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
