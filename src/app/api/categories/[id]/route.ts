import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

async function getDescendantIds(categoryId: string): Promise<string[]> {
    const descendants: string[] = [];
    let currentLevelIds = [categoryId];

    while (currentLevelIds.length > 0) {
        const children = await prisma.category.findMany({
            where: { parentId: { in: currentLevelIds } },
            select: { id: true },
        });

        const childIds = children.map((child) => child.id);
        if (childIds.length === 0) break;

        descendants.push(...childIds);
        currentLevelIds = childIds;
    }

    return descendants;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const category = await prisma.category.findUnique({
            where: { id },
            include: {
                children: true,
                _count: {
                    select: { transactions: true },
                },
            },
        });

        if (!category) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        return NextResponse.json(category);
    } catch (error) {
        console.error('Failed to fetch category:', error);
        return NextResponse.json({ error: 'Failed to fetch category' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, color, icon, parentId, budget } = body;
        const nextParentId = parentId || null;

        // Check if category exists
        const existing = await prisma.category.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        // Check for circular reference (category can't be its own parent)
        if (nextParentId === id) {
            return NextResponse.json({ error: 'Category cannot be its own parent' }, { status: 400 });
        }

        let resolvedColor = color || existing.color;

        if (nextParentId) {
            const parent = await prisma.category.findUnique({
                where: { id: nextParentId },
                select: { color: true },
            });

            if (!parent) {
                return NextResponse.json({ error: 'Parent category not found' }, { status: 400 });
            }

            // Subcategories always inherit parent color
            resolvedColor = parent.color;
        }

        const category = await prisma.category.update({
            where: { id },
            data: {
                name,
                color: resolvedColor,
                icon,
                parentId: nextParentId,
                budget: budget || null,
            },
        });

        // Keep descendants in sync with the category color.
        const descendantIds = await getDescendantIds(id);
        if (descendantIds.length > 0) {
            await prisma.category.updateMany({
                where: { id: { in: descendantIds } },
                data: { color: resolvedColor },
            });
        }

        return NextResponse.json(category);
    } catch (error) {
        console.error('Failed to update category:', error);
        return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Check if category exists
        const existing = await prisma.category.findUnique({
            where: { id },
            include: {
                children: true,
            },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        // Delete child categories first
        if (existing.children.length > 0) {
            await prisma.category.deleteMany({
                where: { parentId: id },
            });
        }

        // Uncategorize transactions in this category
        await prisma.transaction.updateMany({
            where: { categoryId: id },
            data: { categoryId: null },
        });

        // Delete the category
        await prisma.category.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete category:', error);
        return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
    }
}
