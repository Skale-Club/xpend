import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { learnFromCorrection } from '@/lib/autoCategorize';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { transactionIds, categoryId } = body;

        if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
            return NextResponse.json({ error: 'Transaction IDs are required' }, { status: 400 });
        }

        // Update all transactions
        await prisma.transaction.updateMany({
            where: {
                id: { in: transactionIds },
            },
            data: {
                categoryId: categoryId || null,
            },
        });

        // Learn from the correction if a category was assigned
        if (categoryId) {
            // Get one of the transactions to learn from
            const transaction = await prisma.transaction.findFirst({
                where: { id: transactionIds[0] },
                select: { description: true },
            });

            if (transaction) {
                await learnFromCorrection(transaction.description, categoryId);
            }
        }

        return NextResponse.json({
            success: true,
            updatedCount: transactionIds.length
        });
    } catch (error) {
        console.error('Failed to bulk categorize:', error);
        return NextResponse.json({ error: 'Failed to bulk categorize transactions' }, { status: 500 });
    }
}
