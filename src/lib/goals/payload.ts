import type { Prisma } from '@/generated/prisma';

/**
 * Normalize a raw request body into a Prisma Goal create/update payload.
 * Shared by the POST and PUT handlers so create and edit stay in sync.
 */
export function buildGoalData(body: Record<string, unknown>): Prisma.GoalUncheckedCreateInput {
  const targetDate =
    body.targetDate && body.targetDate !== ''
      ? new Date(body.targetDate as string)
      : null;

  return {
    name: (body.name as string).trim(),
    type: body.type as Prisma.GoalUncheckedCreateInput['type'],
    status: (body.status as Prisma.GoalUncheckedCreateInput['status']) ?? 'ACTIVE',
    priority: (body.priority as Prisma.GoalUncheckedCreateInput['priority']) ?? 'MEDIUM',
    targetAmount: Number(body.targetAmount) || 0,
    currentAmount: Number(body.currentAmount) || 0,
    targetDate,
    interestRate: body.interestRate != null && body.interestRate !== '' ? Number(body.interestRate) : null,
    minimumPayment: body.minimumPayment != null && body.minimumPayment !== '' ? Number(body.minimumPayment) : null,
    monthsOfCoverage: body.monthsOfCoverage != null && body.monthsOfCoverage !== '' ? Number(body.monthsOfCoverage) : null,
    metadata: (body.metadata as Prisma.InputJsonValue) ?? undefined,
    description: body.description ? String(body.description).trim() : null,
    linkedAccountId: (body.linkedAccountId as string) || null,
    linkedCategoryId: (body.linkedCategoryId as string) || null,
  };
}
