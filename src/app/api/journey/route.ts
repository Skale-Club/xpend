import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOrCreateDefaultJourney } from '@/lib/memory/journey';

export async function GET() {
  try {
    const journey = await getOrCreateDefaultJourney();
    const entries = await prisma.journeyEntry.findMany({
      where: { journeyId: journey.id },
      orderBy: { happenedAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ ...journey, entries });
  } catch (error) {
    console.error('Failed to fetch journey:', error);
    return NextResponse.json({ error: 'Failed to fetch journey' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const journey = await getOrCreateDefaultJourney();

    const updated = await prisma.financialJourney.update({
      where: { id: journey.id },
      data: {
        title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined,
        summary: body.summary !== undefined ? (body.summary ? String(body.summary) : null) : undefined,
        currentFocus: body.currentFocus !== undefined ? (body.currentFocus ? String(body.currentFocus) : null) : undefined,
        status: body.status === 'archived' || body.status === 'active' ? body.status : undefined,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update journey:', error);
    return NextResponse.json({ error: 'Failed to update journey' }, { status: 500 });
  }
}
