/**
 * Error messages returned to MCP clients. Tool code throws intentional,
 * human-readable validation errors, but database driver errors (Prisma) carry
 * schema and query details that must never be echoed to external clients.
 */
export function safeToolErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const name = error.constructor?.name ?? '';
    if (name.startsWith('Prisma') || 'clientVersion' in error) {
      return 'Internal error';
    }
    return error.message;
  }
  return 'Internal error';
}
