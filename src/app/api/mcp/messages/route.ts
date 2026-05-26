import { validateMcpToken } from '@/lib/mcp/auth';
import { handleJsonRpc } from '@/lib/mcp/jsonrpc';
import { getSession, sendSse } from '@/lib/mcp/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenParam = searchParams.get('token');
  const sessionId = searchParams.get('sessionId') ?? '';

  const mcpToken = await validateMcpToken(tokenParam ? `Bearer ${tokenParam}` : null);
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

  const session = getSession(sessionId);

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
}
