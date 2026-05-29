import { prisma } from '@/lib/db';
import type { FaturaMeta } from '@/lib/pdfParser';

interface ApplyFaturaParams {
  accountId: string;
  statementId: string;
  referenceMonth: number;
  referenceYear: number;
  faturaMeta: FaturaMeta | null;
}

/**
 * Materializes a credit-card fatura into a CreditCardInvoice and propagates the
 * extracted metadata to the Account snapshot. Idempotent: safe to re-run on a
 * re-upload of the same statement.
 *
 * Payment fields (status / paidAt / paidAmount) are intentionally never written
 * here — those are owned by the user "mark as paid" action, so re-uploading an
 * extracted fatura can never reset a PAID invoice back to OPEN.
 */
export async function applyFaturaToInvoice({
  accountId,
  statementId,
  referenceMonth,
  referenceYear,
  faturaMeta,
}: ApplyFaturaParams): Promise<void> {
  const meta = faturaMeta ?? null;

  // Only carry non-null extracted values so a sparse extraction (or a CSV upload
  // with no metadata) never wipes previously stored fields.
  const invoiceData = {
    closingDate: meta?.closingDate ?? undefined,
    dueDate: meta?.dueDate ?? undefined,
    totalAmount: meta?.totalAmount ?? undefined,
    minimumPayment: meta?.minimumPayment ?? undefined,
    previousBalance: meta?.previousBalance ?? undefined,
    paymentsReceived: meta?.paymentsReceived ?? undefined,
    creditLimitSnapshot: meta?.creditLimit ?? undefined,
    availableLimitSnapshot: meta?.availableLimit ?? undefined,
  };

  const invoice = await prisma.creditCardInvoice.upsert({
    where: {
      accountId_referenceMonth_referenceYear: { accountId, referenceMonth, referenceYear },
    },
    create: {
      accountId,
      referenceMonth,
      referenceYear,
      statementId,
      ...invoiceData,
    },
    update: {
      statementId,
      ...invoiceData,
    },
  });

  // Link this statement's transactions to the invoice. Re-running re-sets the
  // same FK, so this is idempotent.
  await prisma.transaction.updateMany({
    where: { statementId },
    data: { invoiceId: invoice.id },
  });

  // Refresh the Account snapshot from the fatura. Closing/due days come from the
  // extracted dates; only write fields the extraction actually provided.
  const accountUpdate: Record<string, unknown> = {};
  if (meta?.creditLimit != null) accountUpdate.creditLimit = meta.creditLimit;
  if (meta?.closingDate) accountUpdate.closingDay = meta.closingDate.getDate();
  if (meta?.dueDate) accountUpdate.dueDay = meta.dueDate.getDate();
  if (meta?.lastFour) accountUpdate.lastFour = meta.lastFour;
  if (meta?.brand) accountUpdate.brand = meta.brand;
  if (Object.keys(accountUpdate).length > 0) {
    accountUpdate.creditLimitUpdatedAt = new Date();
    await prisma.account.update({ where: { id: accountId }, data: accountUpdate });
  }

  // Cache the raw extracted metadata on the Statement for re-upload idempotency.
  if (meta) {
    await prisma.statement.update({
      where: { id: statementId },
      data: { extractedJson: meta as unknown as object },
    });
  }
}
