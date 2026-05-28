import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ValidationError } from '@/lib/validation';

const MEMORY_TYPES = ['decision', 'assumption', 'plan', 'goal', 'risk', 'preference', 'next_step', 'conversation_summary'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const items = await prisma.memoryReviewQueue.findMany({
      where: status === 'all' ? {} : { status },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error('Failed to fetch review queue:', error);
    return NextResponse.json({ error: 'Failed to fetch review queue' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      throw new ValidationError('Title is required');
    }
    if (!body.content || typeof body.content !== 'string' || body.content.trim().length === 0) {
      throw new ValidationError('Content is required');
    }
    if (!body.proposedMemoryType || !MEMORY_TYPES.includes(body.proposedMemoryType)) {
      throw new ValidationError(`Valid proposedMemoryType is required (${MEMORY_TYPES.join(', ')})`);
    }

    const item = await prisma.memoryReviewQueue.create({
      data: {
        proposedMemoryType: body.proposedMemoryType,
        title: String(body.title).trim(),
        content: String(body.content).trim(),
        extractedFromSessionId: body.extractedFromSessionId || null,
        confidence: body.confidence != null && body.confidence !== '' ? Number(body.confidence) : null,
        status: 'pending',
      },
    });
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to create review item:', error);
    return NextResponse.json({ error: 'Failed to create review item' }, { status: 500 });
  }
}
