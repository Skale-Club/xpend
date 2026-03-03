import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Delete associated transactions first (due to foreign key constraints)
        await prisma.transaction.deleteMany({
            where: { statementId: id },
        });

        // Delete the statement
        await prisma.statement.delete({
            where: { id },
        });

        return NextResponse.json({ success: true, message: 'Statement deleted successfully' });
    } catch (error) {
        console.error('Failed to delete statement:', error);
        return NextResponse.json({ error: 'Failed to delete statement' }, { status: 500 });
    }
}
