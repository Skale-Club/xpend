import { Transaction } from '@/types';
import { formatCurrency, formatDate } from './utils';

interface ExportOptions {
    format: 'csv' | 'json';
    filename?: string;
}

function convertToCSV(transactions: Transaction[]): string {
    const headers = [
        'Date',
        'Description',
        'Amount',
        'Type',
        'Category',
        'Account',
        'Recurring'
    ];

    const rows = transactions.map((tx) => [
        formatDate(tx.date),
        `"${tx.description.replace(/"/g, '""')}"`,
        tx.amount.toString(),
        tx.type,
        tx.category?.name || 'Uncategorized',
        tx.account?.name || '',
        tx.isRecurring ? 'Yes' : 'No'
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

function convertToJSON(transactions: Transaction[]): string {
    const data = transactions.map((tx) => ({
        id: tx.id,
        date: formatDate(tx.date),
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        category: tx.category?.name || 'Uncategorized',
        account: tx.account?.name || '',
        isRecurring: tx.isRecurring,
        notes: tx.notes || null
    }));

    return JSON.stringify(data, null, 2);
}

export function exportTransactions(
    transactions: Transaction[],
    options: ExportOptions
): void {
    const { format, filename = 'transactions' } = options;

    let content: string;
    let mimeType: string;
    let extension: string;

    if (format === 'csv') {
        content = convertToCSV(transactions);
        mimeType = 'text/csv';
        extension = 'csv';
    } else {
        content = convertToJSON(transactions);
        mimeType = 'application/json';
        extension = 'json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function formatTransactionsForDisplay(
    transactions: Transaction[],
    hideSensitiveValues: boolean = false
): Array<{
    date: string;
    description: string;
    amount: string;
    type: string;
    category: string;
    account: string;
}> {
    return transactions.map((tx) => ({
        date: formatDate(tx.date),
        description: tx.description,
        amount: formatCurrency(tx.amount, { hideSensitiveValues }),
        type: tx.type,
        category: tx.category?.name || 'Uncategorized',
        account: tx.account?.name || ''
    }));
}
