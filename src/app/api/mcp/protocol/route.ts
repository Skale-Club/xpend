import { validateMcpToken } from '@/lib/mcp/auth';
import { handleJsonRpc, type JsonRpcRequest } from '@/lib/mcp/jsonrpc';
import { withApiLogging } from '@/lib/apiLogger';

export const dynamic = 'force-dynamic';

// Prefer the Authorization header. The ?token= query param is kept only
// because hosted MCP clients (e.g. claude.ai connectors) cannot set custom
// headers — query strings leak into proxy logs and Referer, so any client
// that can send headers should.
function getToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) return `Bearer ${auth.slice(7).trim()}`;

  const { searchParams } = new URL(request.url);
  const param = searchParams.get('token');
  if (param) return `Bearer ${param}`;

  return null;
}

export const POST = withApiLogging(async (request: Request) => {
  const mcpToken = await validateMcpToken(getToken(request));
  if (!mcpToken) {
    return new Response(
      JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Handle batch requests (array of JSON-RPC objects)
  if (Array.isArray(body)) {
    const results = await Promise.all(
      body.map((item) => handleJsonRpc(item as JsonRpcRequest, mcpToken))
    );
    const responses = results.filter(Boolean);
    if (responses.length === 0) return new Response(null, { status: 202 });
    return new Response(JSON.stringify(responses), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const response = await handleJsonRpc(body as JsonRpcRequest, mcpToken);
  if (response === null) return new Response(null, { status: 202 });

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// GET required by Streamable HTTP spec for server-initiated messages (optional)
export const GET = withApiLogging(async (_request: Request) => {
  return new Response(null, { status: 405 });
});
