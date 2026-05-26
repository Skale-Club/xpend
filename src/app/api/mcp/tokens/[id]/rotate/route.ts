import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateToken } from '@/lib/mcp/auth';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.mcpToken.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    const { token, tokenHash, tokenPreview } = generateToken();

    const updated = await prisma.mcpToken.update({
      where: { id },
      data: { tokenHash, tokenPreview, isActive: true, lastUsedAt: null },
      select: {
        id: true,
        name: true,
        tokenPreview: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ...updated, token });
  } catch (error) {
    console.error('Failed to rotate MCP token:', error);
    return NextResponse.json({ error: 'Failed to rotate token' }, { status: 500 });
  }
}
