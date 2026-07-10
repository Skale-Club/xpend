import { NextResponse } from 'next/server';
import { validateMcpToken, hasPermission } from '@/lib/mcp/auth';
import { writeAuditLog } from '@/lib/mcp/audit';
import {
  isValidTool,
  executeTool,
  TOOL_DESCRIPTIONS,
  ALL_TOOLS,
  READ_TOOLS,
  WRITE_TOOLS,
} from '@/lib/mcp/tools/registry';
import { withApiLogging } from '@/lib/apiLogger';
import { safeToolErrorMessage } from '@/lib/mcp/errors';

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export const GET = withApiLogging(async (_request: Request) => {
  return NextResponse.json({
    ok: true,
    version: '1.0',
    entrypoint: 'POST /api/mcp',
    auth: 'Authorization: Bearer <token>',
    tools: ALL_TOOLS.map((name) => ({
      name,
      type: READ_TOOLS.includes(name) ? 'read' : 'write',
      ...TOOL_DESCRIPTIONS[name],
    })),
  });
});

export const POST = withApiLogging(async (request: Request) => {
  const startedAt = Date.now();
  const authHeader = request.headers.get('Authorization');

  const mcpToken = await validateMcpToken(authHeader);
  if (!mcpToken) {
    return errorResponse('UNAUTHORIZED', 'Invalid or missing MCP token.', 401);
  }

  let body: { tool?: string; params?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_PARAMS', 'Request body must be valid JSON.', 400);
  }

  const { tool, params = {} } = body;

  if (!tool || typeof tool !== 'string') {
    return errorResponse('INVALID_PARAMS', 'Field "tool" is required.', 400);
  }

  if (!isValidTool(tool)) {
    return errorResponse('TOOL_NOT_FOUND', `Unknown tool: "${tool}".`, 404);
  }

  if (!hasPermission(mcpToken, tool)) {
    await writeAuditLog({
      tokenId: mcpToken.id,
      tool,
      params,
      outcome: 'error',
      errorCode: 'PERMISSION_DENIED',
      durationMs: Date.now() - startedAt,
    });
    return errorResponse('PERMISSION_DENIED', `Token does not have permission for tool: "${tool}".`, 403);
  }

  try {
    const result = await executeTool(tool, params);
    const durationMs = Date.now() - startedAt;

    await writeAuditLog({
      tokenId: mcpToken.id,
      tool,
      params,
      outcome: 'success',
      durationMs,
    });

    return NextResponse.json({
      ok: true,
      tool,
      result,
      meta: {
        executedAt: new Date().toISOString(),
        durationMs,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = safeToolErrorMessage(error);

    await writeAuditLog({
      tokenId: mcpToken.id,
      tool,
      params,
      outcome: 'error',
      errorCode: 'INTERNAL_ERROR',
      durationMs,
    });

    console.error(`[MCP] Tool "${tool}" failed:`, error);
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
});
