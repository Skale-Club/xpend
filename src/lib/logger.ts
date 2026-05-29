import { prisma } from './db';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';
export type LogCategory = 'api' | 'statement_parse' | 'ai_call';

export interface LogEventInput {
    level?: LogLevel;
    category?: LogCategory;
    method?: string | null;
    path?: string | null;
    status?: number | null;
    durationMs?: number | null;
    message?: string | null;
    metadata?: unknown;
    error?: string | null;
    userEmail?: string | null;
}

function serializeError(error: unknown): string {
    if (error instanceof Error) return error.stack ?? error.message;
    if (typeof error === 'string') return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

/**
 * Persist a single log event. Fire-and-forget by design: logging must never
 * break the request it is observing, so all failures are swallowed (and echoed
 * to the console as a last resort).
 */
export async function logEvent(input: LogEventInput): Promise<void> {
    try {
        await prisma.apiLog.create({
            data: {
                level: input.level ?? 'INFO',
                category: input.category ?? 'api',
                method: input.method ?? null,
                path: input.path ?? null,
                status: input.status ?? null,
                durationMs: input.durationMs ?? null,
                message: input.message ?? null,
                metadata:
                    input.metadata == null
                        ? undefined
                        : (input.metadata as object),
                error: input.error ?? null,
                userEmail: input.userEmail ?? null,
            },
        });
    } catch (err) {
        console.error('[logger] failed to persist log event:', err);
    }
}

/**
 * Convenience helper for HTTP request/response logging. Derives the level from
 * the status code when one is not supplied.
 */
export function logApiRequest(input: {
    method: string;
    path: string;
    status: number;
    durationMs: number;
    userEmail?: string | null;
    error?: unknown;
    metadata?: unknown;
}): Promise<void> {
    const level: LogLevel =
        input.status >= 500 ? 'ERROR' : input.status >= 400 ? 'WARN' : 'INFO';

    return logEvent({
        level,
        category: 'api',
        method: input.method,
        path: input.path,
        status: input.status,
        durationMs: input.durationMs,
        metadata: input.metadata,
        error: input.error === undefined ? null : serializeError(input.error),
        userEmail: input.userEmail ?? null,
    });
}

export { serializeError };
