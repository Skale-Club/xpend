import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateAccountData, ValidationError } from '@/lib/validation';

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(accounts);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input
    validateAccountData(body);

    const account = await prisma.account.create({
      data: {
        name: body.name.trim(),
        type: body.type,
        bank: body.bank?.trim() || null,
        color: body.color || '#3B82F6',
        icon: body.icon || null,
        initialBalance: parseFloat(body.initialBalance) || 0,
        isActive: body.isActive !== undefined ? body.isActive : true,
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
}
