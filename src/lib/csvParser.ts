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

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const transactions = parseTransactions(results.data as Record<string, string>[]);

          // Auto-categorize transactions using rules
          const categorizationResults = await batchCategorize(
            transactions.map((t: ParsedTransaction) => ({ description: t.description, amount: t.amount }))
          );

          // Apply categorization results
          const categorizedTransactions = transactions.map((t: ParsedTransaction, index: number) => ({
            ...t,
            categoryId: categorizationResults.get(index)?.categoryId || null,
          }));

          resolve(categorizedTransactions);
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
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Try MM/DD/YYYY or MM-DD-YYYY (US format)
  const mdyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Try DD/MM/YY or DD-MM-YY
  const dmyShortMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (dmyShortMatch) {
    const [, day, month, yearShort] = dmyShortMatch;
    const year = parseInt(yearShort);
    const fullYear = year > 50 ? 1900 + year : 2000 + year;
    return new Date(fullYear, parseInt(month) - 1, parseInt(day));
  }

  return null;
}
