import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateMemoryData, ValidationError } from '@/lib/validation';
import { canTransition } from '@/lib/memory/status';
import type { Prisma } from '@/generated/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const memory = await prisma.financialMemory.findUnique({
      where: { id },
      include: { links: true, supersedes: true, supersededBy: true },
    });
    if (!memory) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }
    return NextResponse.json(memory);
  } catch (error) {
    console.error('Failed to fetch memory:', error);
    return NextResponse.json({ error: 'Failed to fetch memory' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.financialMemory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

    // Partial validation: only validate fields that are present.
    validateMemoryData(body, { partial: true });

    if (body.status && !canTransition(existing.status, body.status)) {
      return NextResponse.json(
        { error: `Cannot change status from ${existing.status} to ${body.status}` },
        { status: 400 }
      );
    }

    const data: Prisma.FinancialMemoryUpdateInput = {
      title: body.title !== undefined ? String(body.title).trim() : undefined,
      content: body.content !== undefined ? String(body.content).trim() : undefined,
      memoryType: body.memoryType !== undefined ? body.memoryType : undefined,
      status: body.status !== undefined ? body.status : undefined,
      normalizedContent: body.normalizedContent !== undefined ? (body.normalizedContent || null) : undefined,
      relatedEntityType: body.relatedEntityType !== undefined ? (body.relatedEntityType || null) : undefined,
      relatedEntityId: body.relatedEntityId !== undefined ? (body.relatedEntityId || null) : undefined,
      confidence: body.confidence !== undefined ? (body.confidence !== null && body.confidence !== '' ? Number(body.confidence) : null) : undefined,
      priority: body.priority !== undefined && body.priority !== '' ? Number(body.priority) : undefined,
      validUntil: body.validUntil !== undefined ? (body.validUntil ? new Date(body.validUntil) : null) : undefined,
    };

    // Supersede: point this memory at the one that replaces it.
    if (body.supersededById !== undefined) {
      data.supersededBy = body.supersededById
        ? { connect: { id: body.supersededById } }
        : { disconnect: true };
      if (body.supersededById && !body.status) {
        data.status = 'superseded';
      }
    }

    const memory = await prisma.financialMemory.update({
      where: { id },
      data,
      include: { links: true },
    });
    return NextResponse.json(memory);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to update memory:', error);
    return NextResponse.json({ error: 'Failed to update memory' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.financialMemory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete memory:', error);
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 });
  }
}
