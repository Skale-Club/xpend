import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withApiLogging } from '@/lib/apiLogger';
import { requireSession } from '@/lib/auth/requireSession';

export const DELETE = withApiLogging(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const unauthorized = requireSession(request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;

    await prisma.mcpToken.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to revoke MCP token:', error);
    return NextResponse.json({ error: 'Failed to revoke token' }, { status: 500 });
  }
});
