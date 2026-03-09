'use client';

import { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { Button } from './Button';
import { Transaction } from '@/types';
import { exportTransactions } from '@/lib/export';

interface ExportButtonProps {
    transactions: Transaction[];
    filename?: string;
    disabled?: boolean;
}

export function ExportButton({ transactions, filename = 'transactions', disabled }: ExportButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleExport = (format: 'csv' | 'json') => {
        exportTransactions(transactions, { format, filename });
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled || transactions.length === 0}
                className="gap-2"
            >
                <Download className="w-4 h-4" />
                Export
                <ChevronDown className="w-3 h-3" />
            </Button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        <button
                            onClick={() => handleExport('csv')}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-green-600" />
                            <div>
                                <div className="font-medium">Export as CSV</div>
                                <div className="text-xs text-gray-500">Spreadsheet format</div>
                            </div>
                        </button>
                        <button
                            onClick={() => handleExport('json')}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
                        >
                            <FileJson className="w-4 h-4 text-blue-600" />
                            <div>
                                <div className="font-medium">Export as JSON</div>
                                <div className="text-xs text-gray-500">Raw data format</div>
                            </div>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
