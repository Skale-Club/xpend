import type { McpToken } from '@/generated/prisma';

interface McpSession {
  controller: ReadableStreamDefaultController<Uint8Array>;
  token: McpToken;
}

// Module-level store — persists across requests on the same serverless instance.
// Works for single-user personal apps; replace with Redis for multi-instance setups.
export const sessions = new Map<string, McpSession>();

export function addSession(id: string, session: McpSession) {
  sessions.set(id, session);
}

export function getSession(id: string): McpSession | undefined {
  return sessions.get(id);
}

export function removeSession(id: string) {
  sessions.delete(id);
}

const encoder = new TextEncoder();

export function sendSse(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: string,
  data: string
) {
  const line = event === 'message'
    ? `data: ${data}\n\n`
    : `event: ${event}\ndata: ${data}\n\n`;
  controller.enqueue(encoder.encode(line));
}
