import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateAccountData, ValidationError } from '@/lib/validation';
import { withApiLogging } from '@/lib/apiLogger';

function normalizeInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function normalizeFloat(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export const GET = withApiLogging(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    return NextResponse.json(account);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch account' }, { status: 500 });
  }
});

export const PUT = withApiLogging(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    validateAccountData(body);

    // Stamp creditLimitUpdatedAt only when the limit actually changes, so a
    // plain edit doesn't reset the "last refreshed" timestamp.
    const existing = await prisma.account.findUnique({
      where: { id },
      select: { creditLimit: true, creditLimitUpdatedAt: true },
    });
    const newLimit = normalizeFloat(body.creditLimit);
    const limitChanged = existing ? existing.creditLimit !== newLimit : newLimit != null;

    const account = await prisma.account.update({
      where: { id },
      data: {
        name: body.name.trim(),
        type: body.type,
        bank: body.bank?.trim() || null,
        color: body.color || '#3B82F6',
        icon: body.icon || null,
        initialBalance: parseFloat(body.initialBalance) || 0,
        isActive: body.isActive !== undefined ? body.isActive : true,
        openingMonth: normalizeInt(body.openingMonth),
        openingYear: normalizeInt(body.openingYear),
        creditLimit: newLimit,
        closingDay: normalizeInt(body.closingDay),
        dueDay: normalizeInt(body.dueDay),
        lastFour: body.lastFour?.trim() || null,
        brand: body.brand?.trim() || null,
        creditLimitUpdatedAt: limitChanged
          ? newLimit != null
            ? new Date()
            : null
          : existing?.creditLimitUpdatedAt ?? null,
      },
    });
    return NextResponse.json(account);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to update account:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
});

export const DELETE = withApiLogging(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    await prisma.account.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
});
