import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

async function ensureGamesCategoryExists() {
  await prisma.$transaction(async (tx) => {
    let entertainment = await tx.category.findFirst({
      where: { name: 'Entertainment' },
      select: { id: true, color: true },
    });

    if (!entertainment) {
      const createdEntertainment = await tx.category.create({
        data: {
          name: 'Entertainment',
          color: '#F59E0B',
          icon: 'Film',
          isSystem: true,
        },
        select: { id: true, color: true },
      });
      entertainment = createdEntertainment;
    }

    const games = await tx.category.findFirst({
      where: { name: 'Games' },
      select: { id: true, parentId: true, color: true, icon: true },
    });

    if (!games) {
      await tx.category.create({
        data: {
          name: 'Games',
          color: entertainment.color,
          icon: 'Gamepad2',
          parentId: entertainment.id,
          isSystem: true,
        },
      });
      return;
    }

    if (
      games.parentId !== entertainment.id ||
      games.color !== entertainment.color ||
      games.icon !== 'Gamepad2'
    ) {
      await tx.category.update({
        where: { id: games.id },
        data: {
          parentId: entertainment.id,
          color: entertainment.color,
          icon: 'Gamepad2',
          isSystem: true,
        },
      });
    }
  });
}

export async function GET() {
  try {
    await ensureGamesCategoryExists();

    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(categories);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    let color = body.color || '#6B7280';
    const parentId = body.parentId || null;

    if (parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: parentId },
        select: { color: true },
      });

      if (!parent) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 400 });
      }

      // Subcategories always inherit parent color
      color = parent.color;
    }

    const category = await prisma.category.create({
      data: {
        name: body.name,
        color,
        icon: body.icon,
        parentId,
      },
    });
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
