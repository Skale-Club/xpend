import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const rules = await prisma.categorizationRule.findMany({
            include: {
                category: {
                    select: { id: true, name: true, color: true, icon: true },
                },
            },
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'asc' },
            ],
        });

        return NextResponse.json(rules);
    } catch (error) {
        console.error('Failed to fetch categorization rules:', error);
        return NextResponse.json({ error: 'Failed to fetch categorization rules' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { categoryId, keywords, matchType, priority } = body;

        if (!categoryId || !keywords) {
            return NextResponse.json({ error: 'Category and keywords are required' }, { status: 400 });
        }

        // Verify category exists
        const category = await prisma.category.findUnique({
            where: { id: categoryId },
        });

        if (!category) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        const rule = await prisma.categorizationRule.create({
            data: {
                categoryId,
                keywords,
                matchType: matchType || 'contains',
                priority: priority || 0,
                isActive: true,
            },
            include: {
                category: {
                    select: { id: true, name: true, color: true, icon: true },
                },
            },
        });

        return NextResponse.json(rule);
    } catch (error) {
        console.error('Failed to create categorization rule:', error);
        return NextResponse.json({ error: 'Failed to create categorization rule' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, categoryId, keywords, matchType, priority, isActive } = body;

        if (!id) {
            return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
        }

        const rule = await prisma.categorizationRule.update({
            where: { id },
            data: {
                categoryId,
                keywords,
                matchType,
                priority,
                isActive,
            },
            include: {
                category: {
                    select: { id: true, name: true, color: true, icon: true },
                },
            },
        });

        return NextResponse.json(rule);
    } catch (error) {
        console.error('Failed to update categorization rule:', error);
        return NextResponse.json({ error: 'Failed to update categorization rule' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
        }

        await prisma.categorizationRule.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete categorization rule:', error);
        return NextResponse.json({ error: 'Failed to delete categorization rule' }, { status: 500 });
    }
}
