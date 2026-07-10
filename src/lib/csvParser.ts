import Papa from 'papaparse';
import { batchCategorize } from './autoCategorize';

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  categoryId?: string | null;
}

export async function parseCSV(file: File): Promise<ParsedTransaction[]> {
  // Convert File to text first (works in both browser and server with Next.js)
  const text = await file.text();

  // Venmo statements carry a 2-line preamble that breaks header-based parsing,
  // ISO datetimes, and US "- $12.50" amounts; route them to a dedicated parser.
  if (isVenmoStatement(text)) {
    return categorize(parseVenmoStatement(text));
  }

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const transactions = parseTransactions(results.data as Record<string, string>[]);
          resolve(await categorize(transactions));
        } catch (error) {
          reject(error);
        }
      },
      error: (error: Error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      },
    });
  });
}

async function categorize(transactions: ParsedTransaction[]): Promise<ParsedTransaction[]> {
  const results = await batchCategorize(
    transactions.map((t) => ({ description: t.description, amount: t.amount })),
  );
  return transactions.map((t, index) => ({
    ...t,
    categoryId: results.get(index)?.categoryId || null,
  }));
}

function parseTransactions(rows: Record<string, string>[]): ParsedTransaction[] {
  const normalizedRows = rows.map(normalizeRowKeys);

  // Ambiguous numeric dates ("05/02/2024") cannot be disambiguated row by row.
  // Scan the whole file first: any row where a component exceeds 12 reveals
  // which side is the day, and a single statement never mixes formats.
  const dateOrder = inferDateOrder(
    normalizedRows.map(findDateString).filter((v): v is string => Boolean(v))
  );

  const transactions: ParsedTransaction[] = [];

  for (const normalizedRow of normalizedRows) {
    const transaction = parseTransaction(normalizedRow, dateOrder);
    if (transaction) {
      transactions.push(transaction);
    }
  }

  return transactions;
}

function normalizeRowKeys(row: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key.toLowerCase().trim();
    normalized[normalizedKey] = value;
  }

  return normalized;
}

const DATE_FIELDS = ['date', 'data', 'transaction date', 'posting date', 'value date', 'fecha'];

function findDateString(row: Record<string, string>): string | undefined {
  for (const field of DATE_FIELDS) {
    if (row[field]) return row[field];
  }
  return undefined;
}

function parseTransaction(row: Record<string, string>, dateOrder: DateOrder): ParsedTransaction | null {
  const dateStr = findDateString(row);
  if (!dateStr) {
    return null;
  }

  // Try to find description field
  const descFields = ['description', 'memo', 'narrative', 'transaction description', 'details', 'descricao', 'descrição', 'histórico', 'historico'];
  let description: string | undefined;

  for (const field of descFields) {
    if (row[field]) {
      description = row[field];
      break;
    }
  }

  if (!description) {
    description = 'Unknown transaction';
  }

  // Try to find amount field
  const amountFields = ['amount', 'value', 'transaction amount', 'sum', 'valor', 'montante'];
  let amountStr: string | undefined;

  for (const field of amountFields) {
    if (row[field]) {
      amountStr = row[field];
      break;
    }
  }

  // If no direct amount field, look for debit/credit or entrada/saida
  let amount: number | undefined;
  let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';

  if (amountStr) {
    amount = parseAmount(amountStr);
    type = amount >= 0 ? 'INCOME' : 'EXPENSE';
    amount = Math.abs(amount);
  } else {
    // Try debit/credit format
    const debitFields = ['debit', 'débito', 'debito', 'saida', 'saída', 'withdrawal'];
    const creditFields = ['credit', 'crédito', 'credito', 'entrada', 'deposit', 'income'];

    let debit: number | undefined;
    let credit: number | undefined;

    for (const field of debitFields) {
      if (row[field]) {
        debit = parseAmount(row[field]);
        break;
      }
    }

    for (const field of creditFields) {
      if (row[field]) {
        credit = parseAmount(row[field]);
        break;
      }
    }

    if (debit !== undefined && debit > 0) {
      amount = debit;
      type = 'EXPENSE';
    } else if (credit !== undefined && credit > 0) {
      amount = credit;
      type = 'INCOME';
    } else {
      return null;
    }
  }

  if (amount === undefined || isNaN(amount)) {
    return null;
  }

  const date = parseDate(dateStr, dateOrder);
  if (!date) {
    return null;
  }

  return {
    date,
    description: description.trim(),
    amount,
    type,
  };
}

export function parseAmount(value: string): number {
  // Strip currency symbols, codes and whitespace — keep only digits,
  // separators, parentheses and signs.
  let cleaned = value.replace(/[^\d.,()\-+]/g, '');

  // Both separators present: the decimal separator is whichever appears last
  // ("1,234.56" is US, "1.234,56" is European).
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')) {
      cleaned = cleaned.replace(/,/g, '');
    } else {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
  } else if (cleaned.includes(',')) {
    // If only comma, it might be decimal separator
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = cleaned.replace(',', '.');
    } else {
      // Comma is thousands separator
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  // Handle negative numbers with parentheses
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }

  // Handle minus sign at the end (some banks use this)
  if (cleaned.endsWith('-')) {
    cleaned = '-' + cleaned.slice(0, -1);
  }

  // NaN is intentional for unparseable values so callers can skip the row —
  // collapsing it to 0 would silently import a wrong amount.
  return parseFloat(cleaned);
}

export type DateOrder = 'DMY' | 'MDY';

const NUMERIC_DATE = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/;

/**
 * Decide whether a file's numeric dates are day-first or month-first by
 * looking for any component that can only be a day (> 12). Defaults to MDY
 * when every date is ambiguous, matching this parser's historical behavior
 * (`new Date("05/02/2024")` parsed as US month-first).
 */
export function inferDateOrder(dateStrings: string[]): DateOrder {
  for (const value of dateStrings) {
    const match = value.trim().match(NUMERIC_DATE);
    if (!match) continue;
    const first = parseInt(match[1], 10);
    const second = parseInt(match[2], 10);
    if (first > 12 && second <= 12) return 'DMY';
    if (second > 12 && first <= 12) return 'MDY';
  }
  return 'MDY';
}

/**
 * All dates are normalized to UTC midnight. Mixing UTC (ISO branch) with
 * server-local time (numeric branches) used to break the upload dedup, which
 * compares exact timestamps.
 */
export function parseDate(value: string, dateOrder: DateOrder = 'MDY'): Date | null {
  const trimmed = value.trim();

  // ISO format (YYYY-MM-DD, optionally with a time part)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return buildUtcDate(
      parseInt(isoMatch[1], 10),
      parseInt(isoMatch[2], 10),
      parseInt(isoMatch[3], 10)
    );
  }

  // Numeric dates with / - or . separators (DD/MM/YYYY, MM/DD/YYYY, DD/MM/YY)
  const numericMatch = trimmed.match(NUMERIC_DATE);
  if (numericMatch) {
    const first = parseInt(numericMatch[1], 10);
    const second = parseInt(numericMatch[2], 10);
    let year = parseInt(numericMatch[3], 10);
    if (numericMatch[3].length === 2) {
      year = year > 50 ? 1900 + year : 2000 + year;
    }

    // A component > 12 can only be the day, regardless of the file-level order.
    let day: number;
    let month: number;
    if (first > 12) {
      day = first;
      month = second;
    } else if (second > 12) {
      month = first;
      day = second;
    } else if (dateOrder === 'DMY') {
      day = first;
      month = second;
    } else {
      month = first;
      day = second;
    }

    return buildUtcDate(year, month, day);
  }

  // Last resort for verbose formats ("15 Jan 2024"). Slash/dash numeric dates
  // never reach this: the engine's parsing of those is locale-ambiguous.
  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function buildUtcDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject silent overflow like 31/02 → 02/03.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

// ---------------------------------------------------------------------------
// Venmo statement support
//
// Venmo exports a CSV with a 2-line preamble ("Account Statement - (@user)",
// "Account Activity"), a header row, balance-only rows, and a trailing
// multi-line legal disclaimer. Transaction rows are identified by a long
// numeric ID + ISO datetime. Amounts are US-format with a leading sign and
// "$": e.g. "- $12.50", "+ $230.00".
// ---------------------------------------------------------------------------

export function isVenmoStatement(text: string): boolean {
  const head = text.slice(0, 500);
  return /Account Statement\s*-\s*\(@/i.test(head) && /Account Activity/i.test(head);
}

export function parseVenmoStatement(text: string): ParsedTransaction[] {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
  const rows = parsed.data;

  // Locate the header row (the one naming the Venmo columns).
  const headerIndex = rows.findIndex(
    (r) => r.includes('ID') && r.includes('Datetime') && r.includes('Amount (total)'),
  );
  if (headerIndex === -1) return [];

  const header = rows[headerIndex];
  const col = (name: string) => header.indexOf(name);
  const idCol = col('ID');
  const dateCol = col('Datetime');
  const typeCol = col('Type');
  const noteCol = col('Note');
  const fromCol = col('From');
  const toCol = col('To');
  const amountCol = col('Amount (total)');
  const destCol = col('Destination');

  const transactions: ParsedTransaction[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const id = (row[idCol] ?? '').trim();
    const datetime = (row[dateCol] ?? '').trim();

    // Only true transaction rows have a long numeric ID and an ISO datetime;
    // balance-only rows and the trailing disclaimer are skipped.
    if (!/^\d{10,}$/.test(id)) continue;
    if (!/^\d{4}-\d{2}-\d{2}T/.test(datetime)) continue;

    const amount = parseVenmoAmount(row[amountCol] ?? '');
    if (amount === null || amount === 0) continue;

    const date = new Date(datetime);
    if (isNaN(date.getTime())) continue;

    const type: 'INCOME' | 'EXPENSE' = amount > 0 ? 'INCOME' : 'EXPENSE';
    const txType = (row[typeCol] ?? '').trim();
    const note = (row[noteCol] ?? '').trim();
    const from = (row[fromCol] ?? '').trim();
    const to = (row[toCol] ?? '').trim();
    const dest = (row[destCol] ?? '').trim();

    // Counterparty: who the money went to (expense) / came from (income).
    // Standard Transfers have no From/To, so fall back to the destination.
    let counterparty: string;
    if (type === 'INCOME') {
      counterparty = from || txType;
    } else {
      counterparty = to || dest || txType;
    }

    const parts = [counterparty];
    if (note) parts.push(note);
    const description = parts.join(' - ').trim() || txType || 'Venmo transaction';

    transactions.push({ date, description, amount: Math.abs(amount), type });
  }

  return transactions;
}

// Parses Venmo's US-format signed amounts: "- $12.50", "+ $230.00", "$50.00".
// Returns a signed number, or null when no amount is present.
function parseVenmoAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const negative = /^-|\(/.test(trimmed);
  const digits = trimmed.replace(/[^\d.]/g, '');
  if (!digits) return null;

  const magnitude = parseFloat(digits.replace(/,/g, ''));
  if (isNaN(magnitude)) return null;

  return negative ? -magnitude : magnitude;
}
