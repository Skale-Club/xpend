import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/db';

// Query tools
export const getTransactions = tool({
    description: 'Get transactions with optional filters. Returns transaction details including date, amount, description, category, and account.',
    parameters: z.object({
        dateFrom: z.string().optional().describe('Start date filter (ISO format YYYY-MM-DD)'),
        dateTo: z.string().optional().describe('End date filter (ISO format YYYY-MM-DD)'),
        categoryId: z.string().optional().describe('Filter by category ID'),
        accountId: z.string().optional().describe('Filter by account ID'),
        minAmount: z.number().optional().describe('Minimum amount filter'),
        maxAmount: z.number().optional().describe('Maximum amount filter'),
        searchQuery: z.string().optional().describe('Search in transaction description'),
        limit: z.number().default(10).describe('Maximum number of results'),
    }),
    execute: async (params) => {
        const where: Record<string, unknown> = {};

        if (params.dateFrom || params.dateTo) {
            where.date = {};
            if (params.dateFrom) where.date.gte = new Date(params.dateFrom);
            if (params.dateTo) where.date.lte = new Date(params.dateTo);
        }

        if (params.categoryId) where.categoryId = params.categoryId;
        if (params.accountId) where.accountId = params.accountId;

        if (params.minAmount !== undefined || params.maxAmount !== undefined) {
            where.amount = {};
            if (params.minAmount !== undefined) where.amount.gte = params.minAmount;
            if (params.maxAmount !== undefined) where.amount.lte = params.maxAmount;
        }

        if (params.searchQuery) {
            where.description = { contains: params.searchQuery, mode: 'insensitive' };
        }

        const transactions = await prisma.transaction.findMany({
            where,
            take: params.limit || 10,
            orderBy: { date: 'desc' },
            include: {
                category: { select: { id: true, name: true, color: true } },
                account: { select: { id: true, name: true, color: true } },
            },
        });

        return {
            count: transactions.length,
            transactions: transactions.map(t => ({
                id: t.id,
                date: t.date.toISOString().split('T')[0],
                description: t.description,
                amount: t.amount,
                type: t.type,
                category: t.category?.name || 'Uncategorized',
                account: t.account.name,
            })),
        };
    },
});

export const getSpendingByCategory = tool({
    description: 'Get spending breakdown by category for a given time period.',
    parameters: z.object({
        dateFrom: z.string().optional().describe('Start date filter (ISO format YYYY-MM-DD)'),
        dateTo: z.string().optional().describe('End date filter (ISO format YYYY-MM-DD)'),
        transactionType: z.enum(['INCOME', 'EXPENSE']).optional().describe('Filter by transaction type'),
    }),
    execute: async (params) => {
        const where: Record<string, unknown> = {};

        if (params.dateFrom || params.dateTo) {
            where.date = {};
            if (params.dateFrom) where.date.gte = new Date(params.dateFrom);
            if (params.dateTo) where.date.lte = new Date(params.dateTo);
        }

        if (params.transactionType) {
            where.type = params.transactionType;
        }

        const transactions = await prisma.transaction.findMany({
            where,
            include: {
                category: { select: { id: true, name: true, color: true } },
            },
        });

        const categoryTotals = new Map<string, { name: string; total: number; count: number; color: string }>();

        for (const t of transactions) {
            const categoryName = t.category?.name || 'Uncategorized';
            const categoryColor = t.category?.color || '#6B7280';
            const existing = categoryTotals.get(categoryName);

            if (existing) {
                existing.total += t.amount;
                existing.count += 1;
            } else {
                categoryTotals.set(categoryName, {
                    name: categoryName,
                    total: t.amount,
                    count: 1,
                    color: categoryColor,
                });
            }
        }

        const total = Array.from(categoryTotals.values()).reduce((sum, c) => sum + c.total, 0);

        return {
            totalSpent: total,
            categories: Array.from(categoryTotals.values())
                .map(c => ({
                    ...c,
                    percentage: total > 0 ? Math.round((c.total / total) * 100) : 0,
                }))
                .sort((a, b) => b.total - a.total),
        };
    },
});

export const getMonthlySummary = tool({
    description: 'Get monthly income and expense summary.',
    parameters: z.object({
        months: z.number().default(6).describe('Number of months to include'),
    }),
    execute: async (params) => {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - (params.months || 6) + 1, 1);

        const transactions = await prisma.transaction.findMany({
            where: {
                date: { gte: startDate },
            },
            orderBy: { date: 'asc' },
        });

        const monthlyData = new Map<string, { month: string; income: number; expenses: number }>();

        for (const t of transactions) {
            const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
            const existing = monthlyData.get(monthKey);

            if (existing) {
                if (t.type === 'INCOME') {
                    existing.income += t.amount;
                } else if (t.type === 'EXPENSE') {
                    existing.expenses += t.amount;
                }
            } else {
                monthlyData.set(monthKey, {
                    month: monthKey,
                    income: t.type === 'INCOME' ? t.amount : 0,
                    expenses: t.type === 'EXPENSE' ? t.amount : 0,
                });
            }
        }

        return {
            months: Array.from(monthlyData.values()),
        };
    },
});

export const getCategories = tool({
    description: 'Get list of all available categories.',
    parameters: z.object({}),
    execute: async () => {
        const categories = await prisma.category.findMany({
            select: { id: true, name: true, color: true, icon: true },
            orderBy: { name: 'asc' },
        });

        return {
            categories: categories.map(c => ({
                id: c.id,
                name: c.name,
                color: c.color,
                icon: c.icon,
            })),
        };
    },
});

export const getAccounts = tool({
    description: 'Get list of all accounts.',
    parameters: z.object({}),
    execute: async () => {
        const accounts = await prisma.account.findMany({
            select: { id: true, name: true, type: true, color: true },
            orderBy: { name: 'asc' },
        });

        return {
            accounts: accounts.map(a => ({
                id: a.id,
                name: a.name,
                type: a.type,
                color: a.color,
            })),
        };
    },
});

// Modification tools
export const categorizeTransaction = tool({
    description: 'Update the category of a specific transaction.',
    parameters: z.object({
        transactionId: z.string().describe('The ID of the transaction to update'),
        categoryId: z.string().describe('The ID of the category to assign'),
    }),
    execute: async (params) => {
        const transaction = await prisma.transaction.update({
            where: { id: params.transactionId },
            data: { categoryId: params.categoryId },
            include: {
                category: { select: { name: true } },
            },
        });

        return {
            success: true,
            transaction: {
                id: transaction.id,
                description: transaction.description,
                category: transaction.category?.name || 'Uncategorized',
            },
        };
    },
});

export const categorizeByDescription = tool({
    description: 'Categorize transactions matching a description pattern.',
    parameters: z.object({
        searchPattern: z.string().describe('Text pattern to match in transaction descriptions'),
        categoryId: z.string().describe('The ID of the category to assign'),
        maxTransactions: z.number().default(50).describe('Maximum number of transactions to update'),
    }),
    execute: async (params) => {
        const result = await prisma.transaction.updateMany({
            where: {
                description: { contains: params.searchPattern, mode: 'insensitive' },
            },
            data: { categoryId: params.categoryId },
            take: params.maxTransactions,
        });

        return {
            success: true,
            updatedCount: result.count,
            message: `Updated ${result.count} transaction(s) matching "${params.searchPattern}"`,
        };
    },
});

export const createCategorizationRule = tool({
    description: 'Create a new categorization rule for automatic categorization.',
    parameters: z.object({
        keywords: z.string().describe('Keywords to match in transaction descriptions'),
        categoryId: z.string().describe('The ID of the category to assign when matched'),
        matchType: z.enum(['exact', 'contains', 'regex']).default('contains').describe('How to match the keywords'),
    }),
    execute: async (params) => {
        const category = await prisma.category.findUnique({
            where: { id: params.categoryId },
            select: { name: true },
        });

        if (!category) {
            return { success: false, error: 'Category not found' };
        }

        const rule = await prisma.categorizationRule.create({
            data: {
                categoryId: params.categoryId,
                keywords: params.keywords,
                matchType: params.matchType,
                priority: 1,
                isActive: true,
            },
        });

        return {
            success: true,
            rule: {
                id: rule.id,
                keywords: rule.keywords,
                matchType: rule.matchType,
                categoryName: category.name,
            },
            message: `Created rule: transactions with "${params.keywords}" will be categorized as "${category.name}"`,
        };
    },
});

export const updateTransactionNotes = tool({
    description: 'Add or update notes on a transaction.',
    parameters: z.object({
        transactionId: z.string().describe('The ID of the transaction'),
        notes: z.string().describe('The notes to add'),
    }),
    execute: async (params) => {
        const transaction = await prisma.transaction.update({
            where: { id: params.transactionId },
            data: { notes: params.notes },
        });

        return {
            success: true,
            transaction: {
                id: transaction.id,
                description: transaction.description,
                notes: transaction.notes,
            },
        };
    },
});

export const markRecurring = tool({
    description: 'Mark transactions as recurring or not.',
    parameters: z.object({
        transactionId: z.string().describe('The ID of the transaction'),
        isRecurring: z.boolean().describe('Whether the transaction is recurring'),
    }),
    execute: async (params) => {
        const transaction = await prisma.transaction.update({
            where: { id: params.transactionId },
            data: { isRecurring: params.isRecurring },
        });

        return {
            success: true,
            transaction: {
                id: transaction.id,
                description: transaction.description,
                isRecurring: transaction.isRecurring,
            },
        };
    },
});

// Export all tools
export const chatTools = {
    getTransactions,
    getSpendingByCategory,
    getMonthlySummary,
    getCategories,
    getAccounts,
    categorizeTransaction,
    categorizeByDescription,
    createCategorizationRule,
    updateTransactionNotes,
    markRecurring,
};
