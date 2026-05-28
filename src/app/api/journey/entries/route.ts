import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateJourneyEntryData, ValidationError } from '@/lib/validation';
import { getOrCreateDefaultJourney } from '@/lib/memory/journey';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entryType = searchParams.get('entryType');
    const journey = await getOrCreateDefaultJourney();

    const entries = await prisma.journeyEntry.findMany({
      where: {
        journeyId: journey.id,
        ...(entryType ? { entryType } : {}),
      },
      orderBy: { happenedAt: 'desc' },
    });
    return NextResponse.json(entries);
  } catch (error) {
    console.error('Failed to fetch journey entries:', error);
    return NextResponse.json({ error: 'Failed to fetch journey entries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    validateJourneyEntryData(body);

    const journey = await getOrCreateDefaultJourney();

    const entry = await prisma.journeyEntry.create({
      data: {
        journeyId: journey.id,
        entryType: body.entryType,
        title: String(body.title).trim(),
        summary: body.summary ? String(body.summary) : null,
        source: body.source || 'manual',
        sourceSessionId: body.sourceSessionId || null,
        relatedGoalId: body.relatedGoalId || null,
        relatedPlanId: body.relatedPlanId || null,
        relatedTransactionId: body.relatedTransactionId || null,
        relatedAccountId: body.relatedAccountId || null,
        importance: body.importance || 'medium',
        confidence: body.confidence != null && body.confidence !== '' ? Number(body.confidence) : null,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
        happenedAt: body.happenedAt ? new Date(body.happenedAt) : new Date(),
      },
    });
    return NextResponse.json(entry);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to create journey entry:', error);
    return NextResponse.json({ error: 'Failed to create journey entry' }, { status: 500 });
  }
}
