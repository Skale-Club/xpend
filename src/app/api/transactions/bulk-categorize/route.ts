import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { learnFromCorrection } from '@/lib/autoCategorize';
import { withApiLogging } from '@/lib/apiLogger';

export const POST = withApiLogging(async (request: Request) => {
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

        // Learn from the correction if a category was assigned.
        // Train on every distinct description in the batch so the rule engine
        // generalises correctly regardless of which transaction is first.
        if (categoryId) {
            const transactions = await prisma.transaction.findMany({
                where: { id: { in: transactionIds } },
                select: { description: true },
            });

            // Deduplicate by normalised description to avoid redundant rule writes
            const seenDescriptions = new Set<string>();
            for (const tx of transactions) {
                const key = tx.description.trim().toLowerCase();
                if (!seenDescriptions.has(key)) {
                    seenDescriptions.add(key);
                    await learnFromCorrection(tx.description, categoryId);
                }
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
});
