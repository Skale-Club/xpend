import { prisma } from '@/lib/db';

// The MVP uses a single default journey. This returns it, creating it on first
// access so callers never have to handle a missing journey.
export async function getOrCreateDefaultJourney() {
  const existing = await prisma.financialJourney.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;
  return prisma.financialJourney.create({
    data: { title: 'My Financial Journey', status: 'active' },
  });
}
