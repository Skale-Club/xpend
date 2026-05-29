import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateMemoryData, ValidationError } from '@/lib/validation';
import type { Prisma } from '@/generated/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const memoryType = searchParams.get('memoryType');
    const relatedEntityType = searchParams.get('relatedEntityType');
    const relatedEntityId = searchParams.get('relatedEntityId');
    const q = searchParams.get('q');

    const where: Prisma.FinancialMemoryWhereInput = {
      ...(status ? { status } : {}),
      ...(memoryType ? { memoryType } : {}),
      ...(relatedEntityType ? { relatedEntityType } : {}),
      ...(relatedEntityId ? { relatedEntityId } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { content: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const memories = await prisma.financialMemory.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: { links: true },
    });
    return NextResponse.json(memories);
  } catch (error) {
    console.error('Failed to fetch memories:', error);
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    validateMemoryData(body);

    const memory = await prisma.financialMemory.create({
      data: {
        memoryType: body.memoryType,
        title: String(body.title).trim(),
        content: String(body.content).trim(),
        normalizedContent: body.normalizedContent ? String(body.normalizedContent) : null,
        status: body.status || 'active',
        source: body.source || 'manual',
        sourceSessionId: body.sourceSessionId || null,
        relatedEntityType: body.relatedEntityType || null,
        relatedEntityId: body.relatedEntityId || null,
        confidence: body.confidence != null && body.confidence !== '' ? Number(body.confidence) : null,
        priority: body.priority != null && body.priority !== '' ? Number(body.priority) : 0,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        ...(Array.isArray(body.links) && body.links.length
          ? {
              links: {
                create: body.links.map((l: { entityType: string; entityId: string; relationshipType?: string }) => ({
                  entityType: l.entityType,
                  entityId: l.entityId,
                  relationshipType: l.relationshipType || 'relates_to',
                })),
              },
            }
          : {}),
      },
      include: { links: true },
    });
    return NextResponse.json(memory);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to create memory:', error);
    return NextResponse.json({ error: 'Failed to create memory' }, { status: 500 });
  }
}
