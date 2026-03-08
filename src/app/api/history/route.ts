import { prisma } from '@/lib/db';
import { previewFromStoredContent } from '@/lib/chat/storage';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const limit = Number.parseInt(searchParams.get('limit') || '20', 10);
    const startingAfter = searchParams.get('starting_after');
    const endingBefore = searchParams.get('ending_before');

    if (startingAfter && endingBefore) {
      return Response.json(
        { error: 'Only one of starting_after or ending_before can be provided.' },
        { status: 400 }
      );
    }

    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const extendedLimit = safeLimit + 1;

    let anchorUpdatedAt: Date | null = null;
    if (startingAfter || endingBefore) {
      const anchorSession = await prisma.chatSession.findUnique({
        where: { id: startingAfter || endingBefore || '' },
        select: { updatedAt: true },
      });

      if (!anchorSession) {
        return Response.json({ error: 'Session not found' }, { status: 404 });
      }

      anchorUpdatedAt = anchorSession.updatedAt;
    }

    const sessions = await prisma.chatSession.findMany({
      where: anchorUpdatedAt
        ? startingAfter
          ? { updatedAt: { lt: anchorUpdatedAt } }
          : { updatedAt: { gt: anchorUpdatedAt } }
        : undefined,
      orderBy: { updatedAt: 'desc' },
      take: extendedLimit,
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const hasMore = sessions.length > safeLimit;
    const trimmed = hasMore ? sessions.slice(0, safeLimit) : sessions;

    return Response.json({
      chats: trimmed.map((session) => ({
        id: session.id,
        title: session.title || previewFromStoredContent(session.messages[0]?.content || ''),
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })),
      hasMore,
    });
  } catch (error) {
    console.error('Error loading chat history:', error);
    return Response.json({ chats: [], hasMore: false }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const result = await prisma.chatSession.deleteMany({});
    return Response.json({ deletedCount: result.count }, { status: 200 });
  } catch (error) {
    console.error('Error deleting chat history:', error);
    return Response.json({ error: 'Failed to delete history' }, { status: 500 });
  }
}
