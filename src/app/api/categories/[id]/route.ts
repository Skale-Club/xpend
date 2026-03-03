import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

        // Check if category exists
        const existing = await prisma.category.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        // Check for circular reference (category can't be its own parent)
        if (parentId === id) {
            return NextResponse.json({ error: 'Category cannot be its own parent' }, { status: 400 });
        }

        const category = await prisma.category.update({
            where: { id },
            data: {
                name,
                color,
                icon,
                parentId: parentId || null,
                budget: budget || null,
            },
        });

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
