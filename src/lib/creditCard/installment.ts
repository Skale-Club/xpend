export interface InstallmentInfo {
  number: number;
  total: number;
}

const KEYWORD_PATTERN = /parc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de|of)\s*(\d{1,2})/i;
const TRAILING_PATTERN = /\(?\b(\d{1,2})\s*\/\s*(\d{1,2})\b\)?\s*$/;

/**
 * Extracts installment info ("parcela") from a transaction description.
 *
 * Accepts keyword forms ("PARC 03/12", "Parcela 3 de 12") anywhere, and a bare
 * "NN/NN" only at the end of the string (where banks append installment markers),
 * which keeps mid-string dates like "voo 03/12 GRU" from being misread.
 *
 * Returns null when no plausible installment marker is found.
 */
export function parseInstallment(description: string): InstallmentInfo | null {
  if (!description) return null;

  const keyword = description.match(KEYWORD_PATTERN);
  if (keyword) {
    const info = build(keyword[1], keyword[2]);
    if (info) return info;
  }

  const trailing = description.match(TRAILING_PATTERN);
  if (trailing) {
    const info = build(trailing[1], trailing[2]);
    if (info) return info;
  }

  return null;
}

function build(numberStr: string, totalStr: string): InstallmentInfo | null {
  const number = parseInt(numberStr, 10);
  const total = parseInt(totalStr, 10);
  if (!Number.isFinite(number) || !Number.isFinite(total)) return null;
  // A real installment series has at least 2 parts and number within range.
  if (total < 2 || total > 99) return null;
  if (number < 1 || number > total) return null;
  return { number, total };
}
