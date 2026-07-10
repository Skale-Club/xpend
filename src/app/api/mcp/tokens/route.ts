import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateToken } from '@/lib/mcp/auth';
import { ALL_TOOLS } from '@/lib/mcp/tools/registry';
import { withApiLogging } from '@/lib/apiLogger';
import { requireSession } from '@/lib/auth/requireSession';

export const GET = withApiLogging(async (request: Request) => {
  const unauthorized = requireSession(request);
  if (unauthorized) return unauthorized;
  try {
    const tokens = await prisma.mcpToken.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        tokenPreview: true,
        permissions: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ tokens });
  } catch (error) {
    console.error('Failed to list MCP tokens:', error);
    return NextResponse.json({ error: 'Failed to list tokens' }, { status: 500 });
  }
});

export const POST = withApiLogging(async (request: Request) => {
  const unauthorized = requireSession(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json();
    const { name, permissions } = body as { name?: string; permissions?: string[] };

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Token name is required.' }, { status: 400 });
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return NextResponse.json({ error: 'At least one permission is required.' }, { status: 400 });
    }

    const invalid = permissions.filter((p) => !ALL_TOOLS.includes(p as never));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid permissions: ${invalid.join(', ')}` },
        { status: 400 }
      );
    }

    const { token, tokenHash, tokenPreview } = generateToken();

    const created = await prisma.mcpToken.create({
      data: {
        name: name.trim(),
        tokenHash,
        tokenPreview,
        permissions,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        tokenPreview: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ...created,
      token,
    });
  } catch (error) {
    console.error('Failed to create MCP token:', error);
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
  }
});
