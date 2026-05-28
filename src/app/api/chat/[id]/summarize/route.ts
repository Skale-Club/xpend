import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getMemoryAiConfig } from '@/lib/memory/aiConfig';
import { summarizeConversation } from '@/lib/memory/summarizeConversation';
import { getOrCreateDefaultJourney } from '@/lib/memory/journey';

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
      return NextResponse.json({ error: 'Conversation has no messages to summarize' }, { status: 400 });
    }

    const { apiKey, model } = await getMemoryAiConfig();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI is not configured. Add an OpenRouter API key in Settings.' },
        { status: 400 }
      );
    }

    const result = await summarizeConversation(session.messages, apiKey, model);

    // Persist the conversation summary and add a journey timeline entry.
    const conversationMemory = await prisma.conversationMemory.create({
      data: {
        sessionId: id,
        source: 'chat',
        title: result.title,
        rawSummary: result.summary,
        structuredSummaryJson: JSON.stringify(result),
        keyDecisionsJson: JSON.stringify(result.decisions),
        assumptionsJson: JSON.stringify(result.assumptions),
        nextStepsJson: JSON.stringify(result.nextSteps),
      },
    });

    const journey = await getOrCreateDefaultJourney();
    await prisma.journeyEntry.create({
      data: {
        journeyId: journey.id,
        entryType: 'conversation_summary',
        title: result.title,
        summary: result.summary,
        source: 'chat',
        sourceSessionId: id,
      },
    });

    return NextResponse.json({ conversationMemory, summary: result });
  } catch (error) {
    console.error('Failed to summarize conversation:', error);
    return NextResponse.json({ error: 'Failed to summarize conversation' }, { status: 500 });
  }
}
