import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withApiLogging } from '@/lib/apiLogger';
import type { Prisma } from '@/generated/prisma';
import { requireSuperAdmin } from '@/lib/auth/requireSession';

// Super-admin access is enforced in middleware (isAdminPath + isSuperAdmin) and
// revalidated here as defense in depth.
export const GET = withApiLogging(async (request: Request) => {
    const denied = requireSuperAdmin(request);
    if (denied) return denied;
    try {
        const { searchParams } = new URL(request.url);

        const level = searchParams.get('level');
        const category = searchParams.get('category');
        const search = searchParams.get('search')?.trim();
        const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
        const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10) || 50));

        const where: Prisma.ApiLogWhereInput = {};
        if (level && level !== 'ALL') where.level = level;
        if (category && category !== 'ALL') where.category = category;
        if (search) {
            where.OR = [
                { path: { contains: search, mode: 'insensitive' } },
                { message: { contains: search, mode: 'insensitive' } },
                { error: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [logs, total, levelCounts] = await Promise.all([
            prisma.apiLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.apiLog.count({ where }),
            prisma.apiLog.groupBy({ by: ['level'], _count: { _all: true } }),
        ]);

        const counts = levelCounts.reduce<Record<string, number>>((acc, row) => {
            acc[row.level] = row._count._all;
            return acc;
        }, {});

        return NextResponse.json({
            logs,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
            counts,
        });
    } catch (error) {
        console.error('Failed to fetch logs:', error);
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
});
