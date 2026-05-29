export interface InvoiceForLimit {
  status: string;
  totalAmount: number | null;
  paidAmount: number | null;
  availableLimitSnapshot: number | null;
  referenceMonth: number;
  referenceYear: number;
}

/** Available-limit of the most recently extracted fatura, if any carries one. */
function latestSnapshot(invoices: InvoiceForLimit[]): number | null {
  let best: InvoiceForLimit | null = null;
  for (const inv of invoices) {
    if (inv.availableLimitSnapshot == null) continue;
    if (
      !best ||
      inv.referenceYear > best.referenceYear ||
      (inv.referenceYear === best.referenceYear && inv.referenceMonth > best.referenceMonth)
    ) {
      best = inv;
    }
  }
  return best?.availableLimitSnapshot ?? null;
}

/**
 * Available credit limit for a card.
 *
 * Prefers the freshest `availableLimitSnapshot` extracted from a fatura (it
 * reflects pending authorizations the invoice totals may not capture). When no
 * snapshot exists, computes `creditLimit − Σ(outstanding balance of every
 * not-fully-paid invoice)`. Returns null when neither a limit nor a snapshot is
 * known.
 */
export function computeAvailableLimit(
  creditLimit: number | null,
  invoices: InvoiceForLimit[],
): number | null {
  const snapshot = latestSnapshot(invoices);
  if (snapshot != null) return snapshot;
  if (creditLimit == null) return null;

  let outstanding = 0;
  for (const inv of invoices) {
    if (inv.status === 'PAID') continue;
    const balance = (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0);
    if (balance > 0) outstanding += balance;
  }
  return creditLimit - outstanding;
}
