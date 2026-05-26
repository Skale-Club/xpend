import { prisma } from '@/lib/db';

export type MpcOutcome = 'success' | 'error';

interface AuditEntry {
  tokenId: string;
  tool: string;
  params: Record<string, unknown>;
  outcome: MpcOutcome;
  errorCode?: string;
  durationMs: number;
}

const SENSITIVE_PARAM_KEYS = new Set([
  'notes', 'description', 'searchQuery', 'searchPattern',
]);

function sanitizeParams(params: Record<string, unknown>): string {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (SENSITIVE_PARAM_KEYS.has(key) && typeof value === 'string') {
      sanitized[key] = '[redacted]';
    } else {
      sanitized[key] = value;
    }
  }
  return JSON.stringify(sanitized);
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.mcpAuditLog.create({
      data: {
        tokenId: entry.tokenId,
        tool: entry.tool,
        paramsJson: entry.params ? sanitizeParams(entry.params) : null,
        outcome: entry.outcome,
        errorCode: entry.errorCode ?? null,
        durationMs: entry.durationMs,
      },
    });
  } catch {
    // Audit failure must never break the main request
  }
}
