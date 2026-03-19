import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/subscriptions/[id] - Get a single subscription
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const subscription = await prisma.subscription.findUnique({
            where: { id },
            include: {
                category: true,
                account: true,
            },
        });

        if (!subscription) {
            return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }

        return NextResponse.json(subscription);
    } catch (error) {
        console.error('Failed to fetch subscription:', error);
        return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
    }
}

// PUT /api/subscriptions/[id] - Update a subscription
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        // Check if subscription exists
        const existing = await prisma.subscription.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }

        // Build update data
        const updateData: Record<string, unknown> = {};

        if (body.name !== undefined) updateData.name = body.name.trim();
        if (body.logo !== undefined) updateData.logo = body.logo?.trim() || null;
        if (body.price !== undefined) updateData.price = body.price;
        if (body.currency !== undefined) updateData.currency = body.currency;
        if (body.billingCycle !== undefined) updateData.billingCycle = body.billingCycle;
        if (body.frequency !== undefined) updateData.frequency = body.frequency;
        if (body.nextPayment !== undefined) updateData.nextPayment = new Date(body.nextPayment);
        if (body.autoRenew !== undefined) updateData.autoRenew = body.autoRenew;
        if (body.inactive !== undefined) updateData.inactive = body.inactive;
        if (body.url !== undefined) updateData.url = body.url?.trim() || null;
        if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;
        if (body.categoryId !== undefined) updateData.categoryId = body.categoryId || null;
        if (body.accountId !== undefined) updateData.accountId = body.accountId || null;
        if (body.replacementId !== undefined) updateData.replacementId = body.replacementId || null;
        if (body.source !== undefined) updateData.source = body.source;
        if (body.matchPattern !== undefined) updateData.matchPattern = body.matchPattern || null;
        if (body.lastSeenDate !== undefined) updateData.lastSeenDate = body.lastSeenDate ? new Date(body.lastSeenDate) : null;
        if (body.firstSeenDate !== undefined) updateData.firstSeenDate = body.firstSeenDate ? new Date(body.firstSeenDate) : null;
        if (body.occurrences !== undefined) updateData.occurrences = body.occurrences;
        if (body.avgAmount !== undefined) updateData.avgAmount = body.avgAmount;

        const subscription = await prisma.subscription.update({
            where: { id },
            data: updateData,
            include: {
                category: true,
                account: true,
            },
        });

        return NextResponse.json(subscription);
    } catch (error) {
        console.error('Failed to update subscription:', error);
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
    }
}

// DELETE /api/subscriptions/[id] - Delete a subscription
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Check if subscription exists
        const existing = await prisma.subscription.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }

        await prisma.subscription.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete subscription:', error);
        return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
    }
}
