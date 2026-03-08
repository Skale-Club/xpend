export function parseSearchAmount(search?: string | null): number | null {
  if (!search) return null;

  const normalized = search.trim().replace(/\$/g, '').replace(/,/g, '');
  if (!normalized) return null;
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  // Amounts are stored as positive values with transaction type indicating direction.
  return Math.abs(parsed);
}

export function amountEqualsRange(amount: number, tolerance: number = 0.005) {
  return {
    gte: amount - tolerance,
    lte: amount + tolerance,
  };
}
