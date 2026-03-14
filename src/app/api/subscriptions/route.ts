import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { BillingCycle } from '@/generated/prisma';

export interface SubscriptionStats {
    activeSubscriptions: number;
    inactiveSubscriptions: number;
    totalMonthlyCost: number;
    totalYearlyCost: number;
    mostExpensive: {
        name: string;
        monthlyPrice: number;
    } | null;
    totalSavings: number; // From inactive subscriptions
}

// Helper to calculate monthly price from billing cycle
function getMonthlyPrice(price: number, cycle: BillingCycle, frequency: number): number {
    switch (cycle) {
        case 'DAILY':
            return price * (30 / frequency);
        case 'WEEKLY':
            return price * (4.35 / frequency);
        case 'MONTHLY':
            return price / frequency;
        case 'YEARLY':
            return price / (12 * frequency);
        default:
            return price;
    }
}

// GET /api/subscriptions - List all subscriptions with optional filters
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const inactive = searchParams.get('inactive');
        const categoryId = searchParams.get('categoryId');
        const sort = searchParams.get('sort') || 'nextPayment';
        const includeStats = searchParams.get('stats') === 'true';

        // Build where clause
        const where: {
            inactive?: boolean;
            categoryId?: string;
        } = {};

        if (inactive !== null) {
            where.inactive = inactive === 'true';
        }
        if (categoryId) {
            where.categoryId = categoryId;
        }

        // Build orderBy
        const orderBy: Record<string, unknown>[] = [];
        if (sort === 'price') {
            orderBy.push({ price: 'desc' });
        } else if (sort === 'name') {
            orderBy.push({ name: 'asc' });
        } else {
            orderBy.push({ nextPayment: 'asc' });
        }
        // Always sort inactive to bottom
        orderBy.push({ inactive: 'asc' });

        const subscriptions = await prisma.subscription.findMany({
            where,
            orderBy,
            include: {
                category: true,
                account: true,
            },
        });

        // Calculate stats if requested
        let stats: SubscriptionStats | null = null;
        if (includeStats) {
            const allSubscriptions = await prisma.subscription.findMany();

            let activeSubscriptions = 0;
            let inactiveSubscriptions = 0;
            let totalMonthlyCost = 0;
            let totalSavings = 0;
            let mostExpensive: { name: string; monthlyPrice: number } | null = null;

            for (const sub of allSubscriptions) {
                const monthlyPrice = getMonthlyPrice(sub.price, sub.billingCycle, sub.frequency);

                if (sub.inactive) {
                    inactiveSubscriptions++;
                    totalSavings += monthlyPrice;
                } else {
                    activeSubscriptions++;
                    totalMonthlyCost += monthlyPrice;

                    if (!mostExpensive || monthlyPrice > mostExpensive.monthlyPrice) {
                        mostExpensive = { name: sub.name, monthlyPrice };
                    }
                }
            }

            stats = {
                activeSubscriptions,
                inactiveSubscriptions,
                totalMonthlyCost,
                totalYearlyCost: totalMonthlyCost * 12,
                mostExpensive,
                totalSavings,
            };
        }

        return NextResponse.json({
            subscriptions,
            stats,
        });
    } catch (error) {
        console.error('Failed to fetch subscriptions:', error);
        return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }
}

// POST /api/subscriptions - Create a new subscription
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Validate required fields
        if (!body.name?.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }
        if (typeof body.price !== 'number' || body.price < 0) {
            return NextResponse.json({ error: 'Valid price is required' }, { status: 400 });
        }
        if (!body.nextPayment) {
            return NextResponse.json({ error: 'Next payment date is required' }, { status: 400 });
        }

        const subscription = await prisma.subscription.create({
            data: {
                name: body.name.trim(),
                logo: body.logo?.trim() || null,
                price: body.price,
                currency: body.currency || 'USD',
                billingCycle: body.billingCycle || 'MONTHLY',
                frequency: body.frequency || 1,
                nextPayment: new Date(body.nextPayment),
                autoRenew: body.autoRenew !== false,
                inactive: body.inactive || false,
                url: body.url?.trim() || null,
                notes: body.notes?.trim() || null,
                categoryId: body.categoryId || null,
                accountId: body.accountId || null,
                replacementId: body.replacementId || null,
            },
            include: {
                category: true,
                account: true,
            },
        });

        return NextResponse.json(subscription);
    } catch (error) {
        console.error('Failed to create subscription:', error);
        return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
    }
}
