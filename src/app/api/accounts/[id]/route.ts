import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateAccountData, ValidationError } from '@/lib/validation';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch account' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    validateAccountData(body);

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
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.account.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
