import { validateMcpToken } from '@/lib/mcp/auth';
import { handleJsonRpc } from '@/lib/mcp/jsonrpc';
import { getSession, sendSse } from '@/lib/mcp/session';
import { withApiLogging } from '@/lib/apiLogger';

export const dynamic = 'force-dynamic';

export const POST = withApiLogging(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId') ?? '';

  // Auth: the sessionId was issued to an authenticated SSE stream and is bound
  // to its token server-side. When the session is not on this instance
  // (serverless multi-instance), fall back to the Authorization header —
  // tokens are never accepted via query string.
  const session = getSession(sessionId);
  const mcpToken = session?.token
    ?? await validateMcpToken(request.headers.get('Authorization'));
  if (!mcpToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const response = await handleJsonRpc(body, mcpToken);

  if (response !== null && session) {
    // Send response on the SSE stream
    sendSse(session.controller, 'message', JSON.stringify(response));
    return new Response(null, { status: 202 });
  }

  if (response !== null) {
    // No SSE session found (different instance) — return directly
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(null, { status: 202 }); // notification, no response needed
});
