import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withApiLogging } from '@/lib/apiLogger';

export const PUT = withApiLogging(async (request: Request) => {
  try {
    const body = await request.json();
    const orderedIds: unknown = body?.orderedIds;

    if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'orderedIds must be an array of strings' }, { status: 400 });
    }

    await prisma.$transaction(
      (orderedIds as string[]).map((id, index) =>
        prisma.account.update({ where: { id }, data: { sortOrder: index } })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reorder accounts:', error);
    return NextResponse.json({ error: 'Failed to reorder accounts' }, { status: 500 });
  }
});
