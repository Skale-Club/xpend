import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Approve (promote to a durable memory), reject, or edit a queued candidate.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action as 'approve' | 'reject' | 'edit' | undefined;

    const item = await prisma.memoryReviewQueue.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: 'Review item not found' }, { status: 404 });
    }

    // Allow inline edits to be applied with any action.
    const title = body.title != null ? String(body.title).trim() : item.title;
    const content = body.content != null ? String(body.content).trim() : item.content;
    const memoryType = body.proposedMemoryType || item.proposedMemoryType;

    if (action === 'approve') {
      // Promote to a durable financial memory, then mark the item approved.
      const [memory] = await prisma.$transaction([
        prisma.financialMemory.create({
          data: {
            memoryType,
            title,
            content,
            status: 'active',
            source: 'chat',
            sourceSessionId: item.extractedFromSessionId,
            confidence: item.confidence,
          },
        }),
        prisma.memoryReviewQueue.update({
          where: { id },
          data: { status: 'approved', reviewedAt: new Date(), title, content, proposedMemoryType: memoryType },
        }),
      ]);
      return NextResponse.json({ status: 'approved', memory });
    }

    if (action === 'reject') {
      const updated = await prisma.memoryReviewQueue.update({
        where: { id },
        data: { status: 'rejected', reviewedAt: new Date() },
      });
      return NextResponse.json(updated);
    }

    // Default: edit the proposal in place (keep it pending for later review).
    const updated = await prisma.memoryReviewQueue.update({
      where: { id },
      data: { title, content, proposedMemoryType: memoryType, status: 'edited' },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update review item:', error);
    return NextResponse.json({ error: 'Failed to update review item' }, { status: 500 });
  }
}
