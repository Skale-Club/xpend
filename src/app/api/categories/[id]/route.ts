import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withApiLogging } from '@/lib/apiLogger';
import { validateCategoryData, ValidationError } from '@/lib/validation';

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

export const GET = withApiLogging(async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) => {
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
});

export const PUT = withApiLogging(async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) => {
    try {
        const { id } = await params;
        const body = await request.json();

        validateCategoryData(body);

        const { name, color, icon, parentId, budget } = body;
        const nextParentId = parentId || null;

        // Check if category exists
        const existing = await prisma.category.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        // Check for circular reference: a category cannot be its own parent nor
        // be re-parented under one of its own descendants.
        if (nextParentId === id) {
            return NextResponse.json({ error: 'Category cannot be its own parent' }, { status: 400 });
        }

        const descendantIds = await getDescendantIds(id);

        if (nextParentId && descendantIds.includes(nextParentId)) {
            return NextResponse.json(
                { error: 'Category cannot be moved under one of its own subcategories' },
                { status: 400 }
            );
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

        // Update the category and sync descendant colors atomically.
        const category = await prisma.$transaction(async (tx) => {
            const updated = await tx.category.update({
                where: { id },
                data: {
                    name,
                    color: resolvedColor,
                    icon,
                    parentId: nextParentId,
                    budget: budget || null,
                },
            });

            if (descendantIds.length > 0) {
                await tx.category.updateMany({
                    where: { id: { in: descendantIds } },
                    data: { color: resolvedColor },
                });
            }

            return updated;
        });

        return NextResponse.json(category);
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        console.error('Failed to update category:', error);
        return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
    }
});

export const PATCH = withApiLogging(async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) => {
    try {
        const { id } = await params;
        const body = await request.json();

        const existing = await prisma.category.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        const category = await prisma.category.update({
            where: { id },
            data: { budget: body.budget ?? null },
        });

        return NextResponse.json(category);
    } catch (error) {
        console.error('Failed to update category budget:', error);
        return NextResponse.json({ error: 'Failed to update category budget' }, { status: 500 });
    }
});

export const DELETE = withApiLogging(async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) => {
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

        // Delete children, uncategorize transactions and remove the category
        // atomically — a partial failure must not leave orphaned children or
        // transactions pointing at a deleted category.
        await prisma.$transaction(async (tx) => {
            if (existing.children.length > 0) {
                await tx.category.deleteMany({
                    where: { parentId: id },
                });
            }

            await tx.transaction.updateMany({
                where: { categoryId: id },
                data: { categoryId: null },
            });

            await tx.category.delete({
                where: { id },
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete category:', error);
        return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
    }
});
