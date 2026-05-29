export interface InvoiceReference {
  month: number; // 1-12
  year: number;
}

export interface DateWindow {
  start: Date;
  end: Date;
}

/**
 * Dedup window for a fatura upload. Credit-card cycles cross the calendar-month
 * boundary, so the per-month window used for regular statements would miss rows
 * from the prior calendar month and let re-uploads create duplicates.
 *
 * Widening is safe: dedup matches on exact (date, amount, description), and dates
 * carry the full year/month/day, so distinct transactions can never be merged —
 * a wider window only considers more existing rows.
 */
export function faturaDedupWindow(
  referenceMonth: number,
  referenceYear: number,
  closingDay?: number | null,
): DateWindow {
  if (closingDay && closingDay >= 1 && closingDay <= 31) {
    const end = new Date(referenceYear, referenceMonth - 1, closingDay, 23, 59, 59);
    const start = new Date(referenceYear, referenceMonth - 2, closingDay + 1, 0, 0, 0);
    return { start, end };
  }
  // Fallback without a known closing day: previous-month start to reference-month end.
  const start = new Date(referenceYear, referenceMonth - 2, 1, 0, 0, 0);
  const end = new Date(referenceYear, referenceMonth, 0, 23, 59, 59);
  return { start, end };
}

/**
 * Which fatura a transaction dated `date` belongs to, given a closing day.
 * Transactions after the closing day roll into the next month's fatura.
 */
export function invoiceReferenceForDate(date: Date, closingDay?: number | null): InvoiceReference {
  let month = date.getMonth() + 1; // 1-12
  let year = date.getFullYear();
  if (closingDay && date.getDate() > closingDay) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return { month, year };
}

/** Advances an invoice reference by one month, handling year rollover. */
export function nextInvoiceReference(ref: InvoiceReference): InvoiceReference {
  let month = ref.month + 1;
  let year = ref.year;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return { month, year };
}
