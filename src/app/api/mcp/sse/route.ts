import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { validateMcpToken } from '@/lib/mcp/auth';
import { addSession, removeSession, sendSse } from '@/lib/mcp/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenParam = searchParams.get('token');

  const mcpToken = await validateMcpToken(tokenParam ? `Bearer ${tokenParam}` : null);
  if (!mcpToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionId = crypto.randomUUID();
  const messagesUrl = `${origin}/api/mcp/messages?sessionId=${sessionId}&token=${tokenParam}`;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      addSession(sessionId, {
        controller,
        tokenId: mcpToken.id,
        permissions: mcpToken.permissions,
      });

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
}
