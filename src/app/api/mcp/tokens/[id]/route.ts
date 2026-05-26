import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
}
