import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { validateMcpToken } from '@/lib/mcp/auth';
import { addSession, removeSession, sendSse } from '@/lib/mcp/session';
import { withApiLogging } from '@/lib/apiLogger';

export const dynamic = 'force-dynamic';

export const GET = withApiLogging(async (request: Request) => {
  const { searchParams, origin } = new URL(request.url);

  // Prefer the Authorization header. The ?token= query param is kept only as a
  // legacy fallback for EventSource clients, which cannot set headers — query
  // strings leak into proxy logs and Referer, so header auth should be used.
  const authHeader = request.headers.get('Authorization');
  const tokenParam = searchParams.get('token');
  const mcpToken = await validateMcpToken(
    authHeader ?? (tokenParam ? `Bearer ${tokenParam}` : null)
  );
  if (!mcpToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionId = crypto.randomUUID();
  // The session is bound to the validated token server-side; the token itself
  // must never be embedded in the messages URL.
  const messagesUrl = `${origin}/api/mcp/messages?sessionId=${sessionId}`;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      addSession(sessionId, { controller, token: mcpToken });

      // Send the endpoint event — client uses this URL to POST messages
      sendSse(controller, 'endpoint', messagesUrl);

      // Keepalive ping every 25 s
      const interval = setInterval(() => {
        try {
          sendSse(controller, 'ping', '');
        } catch {
          clearInterval(interval);
          removeSession(sessionId);
        }
      }, 25_000);

      // Clean up when stream is cancelled
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        removeSession(sessionId);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      removeSession(sessionId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});
