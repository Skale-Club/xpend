import { logApiRequest } from './logger';

type Handler<Req extends Request, Args extends unknown[]> = (
    request: Req,
    ...args: Args
) => Response | Promise<Response>;

/**
 * Wraps a Next.js route handler so every invocation records method, path,
 * status, duration, and any thrown error to the ApiLog table. Streaming-safe:
 * the status is captured the moment the Response object is returned (when the
 * headers are ready), while the body streams independently.
 *
 * The authenticated user's email is read from the `x-user-email` header that
 * middleware injects, so no extra Supabase round-trip happens here.
 */
export function withApiLogging<Req extends Request, Args extends unknown[]>(
    handler: Handler<Req, Args>,
): (request: Req, ...args: Args) => Promise<Response> {
    return async (request: Req, ...args: Args): Promise<Response> => {
        const start = Date.now();
        const method = request.method;
        let path = request.url;
        try {
            path = new URL(request.url).pathname;
        } catch {
            // keep raw url if it can't be parsed
        }
        const userEmail = request.headers.get('x-user-email');

        try {
            const response = await handler(request, ...args);
            void logApiRequest({
                method,
                path,
                status: response.status,
                durationMs: Date.now() - start,
                userEmail,
            });
            return response;
        } catch (error) {
            void logApiRequest({
                method,
                path,
                status: 500,
                durationMs: Date.now() - start,
                userEmail,
                error,
            });
            throw error;
        }
    };
}
