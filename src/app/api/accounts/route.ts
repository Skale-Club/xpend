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

export const GET = withApiLogging(async (_request: Request) => {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(accounts);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
});

export const POST = withApiLogging(async (request: Request) => {
  try {
    const body = await request.json();

    // Validate input
    validateAccountData(body);

    // Place new accounts at the end of the manual sort order.
    const last = await prisma.account.aggregate({ _max: { sortOrder: true } });
    const nextSortOrder = (last._max.sortOrder ?? -1) + 1;

    const account = await prisma.account.create({
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
        sortOrder: nextSortOrder,
        creditLimit: normalizeFloat(body.creditLimit),
        closingDay: normalizeInt(body.closingDay),
        dueDay: normalizeInt(body.dueDay),
        lastFour: body.lastFour?.trim() || null,
        brand: body.brand?.trim() || null,
        creditLimitUpdatedAt: normalizeFloat(body.creditLimit) != null ? new Date() : null,
      },
    });
    return NextResponse.json(account);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to create account:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
});
