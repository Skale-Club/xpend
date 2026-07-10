import type { McpToken } from '@/generated/prisma';
import { hasPermission } from './auth';
import { isValidTool, executeTool, TOOL_DESCRIPTIONS, READ_TOOLS, WRITE_TOOLS } from './tools/registry';
import { INPUT_SCHEMAS } from './schemas';
import { writeAuditLog } from './audit';
import { safeToolErrorMessage } from './errors';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const PROTOCOL_VERSION = '2024-11-05';

function ok(id: string | number | null | undefined, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function err(id: string | number | null | undefined, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function buildToolList(permissions: string[]) {
  const all = [...READ_TOOLS, ...WRITE_TOOLS];
  return all
    .filter((name) => permissions.includes(name))
    .map((name) => ({
      name,
      description: TOOL_DESCRIPTIONS[name].description,
      inputSchema: INPUT_SCHEMAS[name] ?? { type: 'object', properties: {} },
    }));
}

export async function handleJsonRpc(
  body: unknown,
  mcpToken: McpToken
): Promise<JsonRpcResponse | null> {
  const req = body as JsonRpcRequest;
  const { method, id, params } = req;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'xpend', version: '1.0.0' },
      });

    case 'notifications/initialized':
      return null;

    case 'ping':
      return ok(id, {});

    case 'tools/list':
      return ok(id, { tools: buildToolList(mcpToken.permissions) });

    case 'tools/call': {
      const toolName = (params as { name?: string })?.name;
      const args = ((params as { arguments?: Record<string, unknown> })?.arguments) ?? {};

      if (!toolName || !isValidTool(toolName)) {
        return err(id, -32601, `Unknown tool: "${toolName}"`);
      }

      if (!hasPermission(mcpToken, toolName)) {
        if (!isNotification) {
          await writeAuditLog({ tokenId: mcpToken.id, tool: toolName, params: args, outcome: 'error', errorCode: 'PERMISSION_DENIED', durationMs: 0 });
        }
        return err(id, -32603, `Permission denied for tool: "${toolName}"`);
      }

      const startedAt = Date.now();
      try {
        const result = await executeTool(toolName, args);
        const durationMs = Date.now() - startedAt;

        if (!isNotification) {
          await writeAuditLog({ tokenId: mcpToken.id, tool: toolName, params: args, outcome: 'success', durationMs });
        }

        return ok(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        });
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const message = safeToolErrorMessage(error);

        if (!isNotification) {
          await writeAuditLog({ tokenId: mcpToken.id, tool: toolName, params: args, outcome: 'error', errorCode: 'INTERNAL_ERROR', durationMs });
        }

        return err(id, -32603, message);
      }
    }

    default:
      if (isNotification) return null;
      return err(id, -32601, `Method not found: "${method}"`);
  }
}
