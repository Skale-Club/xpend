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
  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const normalizedRow = normalizeRowKeys(row);
    const transaction = parseTransaction(normalizedRow);
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

function parseTransaction(row: Record<string, string>): ParsedTransaction | null {
  // Try to find date field
  const dateFields = ['date', 'data', 'transaction date', 'posting date', 'value date', 'fecha'];
  let dateStr: string | undefined;

  for (const field of dateFields) {
    if (row[field]) {
      dateStr = row[field];
      break;
    }
  }

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

  const date = parseDate(dateStr);
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

function parseAmount(value: string): number {
  // Remove currency symbols and whitespace
  let cleaned = value.replace(/[$€£R$\s]/g, '');

  // Handle European format (comma as decimal separator)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // If both exist, assume . is thousands separator and , is decimal
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
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

  return parseFloat(cleaned) || 0;
}

function parseDate(value: string): Date | null {
  const trimmed = value.trim();

  // Try ISO format first (YYYY-MM-DD)
  const isoDate = new Date(trimmed);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  }

  // Try MM/DD/YYYY or MM-DD-YYYY (US format)
  const mdyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  }

  // Try DD/MM/YY or DD-MM-YY
  const dmyShortMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (dmyShortMatch) {
    const [, day, month, yearShort] = dmyShortMatch;
    const year = parseInt(yearShort, 10);
    const fullYear = year > 50 ? 1900 + year : 2000 + year;
    return new Date(fullYear, parseInt(month, 10) - 1, parseInt(day, 10));
  }

  return null;
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
