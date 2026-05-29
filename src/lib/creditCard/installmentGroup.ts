import { createHash } from 'crypto';
import { normalizeDescription } from '../subscriptionDetector';

/**
 * Strips installment markers so every parcel of one purchase normalizes to the
 * same base string (e.g. "LOJA X 03/12" and "LOJA X 04/12" → "LOJA X").
 */
function stripInstallmentMarker(description: string): string {
  return description
    .replace(/parc(?:ela)?\.?\s*\d{1,2}\s*(?:\/|de|of)\s*\d{1,2}/i, ' ')
    .replace(/\(?\b\d{1,2}\s*\/\s*\d{1,2}\b\)?\s*$/, ' ')
    .trim();
}

/**
 * Deterministic group id for an installment purchase. The same purchase across
 * different faturas maps to the same id, so projections and dedup stay stable.
 */
export function installmentGroupId(
  accountId: string,
  description: string,
  total: number,
): string {
  const base = normalizeDescription(stripInstallmentMarker(description));
  return createHash('sha1')
    .update(`${accountId}::${base}::${total}`)
    .digest('hex')
    .slice(0, 24);
}
