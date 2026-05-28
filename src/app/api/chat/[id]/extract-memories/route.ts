import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getMemoryAiConfig } from '@/lib/memory/aiConfig';
import { extractMemories } from '@/lib/memory/extractMemories';

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await prisma.chatSession.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
    }
    if (session.messages.length === 0) {
      return NextResponse.json({ error: 'Conversation has no messages to analyze' }, { status: 400 });
    }

    const { apiKey, model } = await getMemoryAiConfig();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI is not configured. Add an OpenRouter API key in Settings.' },
        { status: 400 }
      );
    }

    const candidates = await extractMemories(session.messages, apiKey, model);

    // Extracted candidates go to the review queue (pending) — they are not
    // auto-promoted to durable memories without user confirmation.
    if (candidates.length > 0) {
      await prisma.memoryReviewQueue.createMany({
        data: candidates.map((c) => ({
          proposedMemoryType: c.memoryType,
          title: c.title,
          content: c.content,
          extractedFromSessionId: id,
          confidence: c.confidence,
          status: 'pending',
        })),
      });
    }

    return NextResponse.json({ extracted: candidates.length, candidates });
  } catch (error) {
    console.error('Failed to extract memories:', error);
    return NextResponse.json({ error: 'Failed to extract memories' }, { status: 500 });
  }
}
