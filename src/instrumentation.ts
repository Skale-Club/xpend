import type { Instrumentation } from 'next';

/**
 * Global safety net: any uncaught error thrown while handling a request — in
 * any route, including ones not individually wrapped — lands here and is
 * persisted. Runs only in the Node.js runtime (where Prisma is available).
 */
export const onRequestError: Instrumentation.onRequestError = async (
    err,
    request,
) => {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;

    try {
        const { logEvent } = await import('./lib/logger');
        await logEvent({
            level: 'ERROR',
            category: 'api',
            method: request.method,
            path: request.path,
            message: 'Uncaught request error',
            error: err instanceof Error ? (err.stack ?? err.message) : String(err),
        });
    } catch (logErr) {
        console.error('[instrumentation] failed to log request error:', logErr);
    }
};
