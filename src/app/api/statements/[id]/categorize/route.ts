import { prisma } from '@/lib/db';
import { getCategorizationRules, matchByRules, suggestByAI } from '@/lib/autoCategorize';
import { withApiLogging } from '@/lib/apiLogger';

export const POST = withApiLogging(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  // Get all uncategorized transactions for this statement
  const transactions = await prisma.transaction.findMany({
    where: {
      statementId: id,
      categoryId: null,
    },
    select: {
      id: true,
      description: true,
      amount: true,
    },
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };

      try {
        const total = transactions.length;
        send({ type: 'start', total });

        if (total === 0) {
          // Nothing to do, but still stamp so the card reflects an AI pass.
          await prisma.statement.update({
            where: { id },
            data: { aiCategorizedAt: new Date() },
          });
          send({ type: 'done', categorizedCount: 0, total: 0 });
          controller.close();
          return;
        }

        // Preload rules + categories once so the loop only does per-row work.
        const [rules, categories] = await Promise.all([
          getCategorizationRules(),
          prisma.category.findMany({ select: { id: true, name: true } }),
        ]);

        let categorizedCount = 0;
        let processed = 0;

        for (const transaction of transactions) {
          const ruleMatch = matchByRules(transaction.description, rules);
          const result =
            ruleMatch ??
            (await suggestByAI(transaction.description, transaction.amount, categories));

          if (result?.categoryId) {
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { categoryId: result.categoryId },
            });
            categorizedCount++;
          }

          processed++;
          send({ type: 'progress', processed, total, categorizedCount });
        }

        // Mark the statement as AI-categorized so the UI can flag it.
        await prisma.statement.update({
          where: { id },
          data: { aiCategorizedAt: new Date() },
        });

        send({ type: 'done', categorizedCount, total });
        controller.close();
      } catch (error) {
        console.error('Failed to auto-categorize statement:', error);
        send({ type: 'error', message: 'Failed to auto-categorize statement' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
});
