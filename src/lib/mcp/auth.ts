import crypto from 'crypto';
import { prisma } from '@/lib/db';
import type { McpToken } from '@/generated/prisma';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateToken(): { token: string; tokenHash: string; tokenPreview: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const token = `xpend_${raw}`;
  const tokenHash = hashToken(token);
  const tokenPreview = `xpend_${raw.slice(0, 8)}...${raw.slice(-4)}`;
  return { token, tokenHash, tokenPreview };
}

export async function validateMcpToken(
  authHeader: string | null
): Promise<McpToken | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const tokenHash = hashToken(token);

  const mcpToken = await prisma.mcpToken.findUnique({
    where: { tokenHash },
  });

  if (!mcpToken || !mcpToken.isActive) return null;

  await prisma.mcpToken.update({
    where: { id: mcpToken.id },
    data: { lastUsedAt: new Date() },
  });

  return mcpToken;
}

export function hasPermission(token: McpToken, tool: string): boolean {
  return token.permissions.includes(tool);
}
