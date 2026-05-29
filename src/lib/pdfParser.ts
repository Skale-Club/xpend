import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { extractText, getDocumentProxy } from 'unpdf';
import { z } from 'zod';
import { prisma } from './db';
import { batchCategorize } from './autoCategorize';
import { DEFAULT_CHAT_MODEL } from './chat/models';
import { parseStatementText, reconcileStatementText, type ParsedTransaction } from './pdfTextParser';
import { parseFaturaText } from './creditCard/faturaTextParser';
import { logEvent, serializeError } from './logger';

export type { ParsedTransaction } from './pdfTextParser';

export interface FaturaMeta {
  creditLimit: number | null;
  availableLimit: number | null;
  closingDate: Date | null;
  dueDate: Date | null;
  totalAmount: number | null;
  minimumPayment: number | null;
  previousBalance: number | null;
  paymentsReceived: number | null;
  lastFour: string | null;
  brand: string | null;
}

export interface ParsePDFResult {
  transactions: ParsedTransaction[];
  faturaMeta: FaturaMeta | null;
}

// Coerces "1.234,56" / "1234.56" / number / null into a number or null.
const numberish = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const cleaned = v.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  });

const dateish = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  });

const faturaMetaSchema = z.object({
  creditLimit: numberish,
  availableLimit: numberish,
  closingDate: dateish,
  dueDate: dateish,
  totalAmount: numberish,
  minimumPayment: numberish,
  previousBalance: numberish,
  paymentsReceived: numberish,
  lastFour: z.union([z.string(), z.null()]).optional().transform((v) => v ?? null),
  brand: z.union([z.string(), z.null()]).optional().transform((v) => v ?? null),
});

const faturaTxSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.union([z.number(), z.string()]),
  type: z.string(),
});

const faturaResponseSchema = z.object({
  metadata: faturaMetaSchema.optional(),
  transactions: z.array(faturaTxSchema),
});

// Get API key and configured chat model from database
async function getOpenRouterConfig(): Promise<{ apiKey: string | null; model: string }> {
    const settings = await prisma.settings.findUnique({
        where: { id: 'default' },
        select: { geminiApiKey: true, geminiChatModel: true },
    });

    return {
        apiKey: settings?.geminiApiKey ?? null,
        model: settings?.geminiChatModel || DEFAULT_CHAT_MODEL,
    };
}

async function fileToBuffer(file: File): Promise<Buffer> {
    const arrayBuffer = await file.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// Extract the merged embedded text from a PDF. Returns '' for image-only PDFs
// or on extraction failure (the caller then falls back to AI).
async function extractPdfText(file: File): Promise<string> {
    try {
        const buffer = await fileToBuffer(file);
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const { text } = await extractText(pdf, { mergePages: true });
        return text;
    } catch (error) {
        console.error('Local PDF text extraction failed:', error);
        void logEvent({
            level: 'WARN',
            category: 'statement_parse',
            message: 'Local PDF text extraction failed',
            metadata: { fileName: file.name },
            error: serializeError(error),
        });
        return '';
    }
}

/**
 * Hybrid PDF parser. Tries a fast, deterministic, offline text parser first;
 * only falls back to the AI parser when the local pass can't extract anything
 * (unrecognized layout or a scanned/image-only PDF).
 */
export async function parsePDF(file: File, accountType?: string): Promise<ParsePDFResult> {
    const meta = { fileName: file.name, fileSize: file.size };

    // Credit-card faturas: try the deterministic US text parser first. It's free,
    // instant, and self-verifies against the statement's printed summary totals.
    // We keep the local result ONLY when it reconciles; otherwise (unrecognized
    // layout — e.g. Brazilian R$ faturas — or a parse that doesn't reconcile) we
    // fall back to the dedicated fatura AI prompt, unchanged.
    if (accountType === 'CREDIT_CARD') {
        const text = await extractPdfText(file);
        const local = text ? parseFaturaText(text) : null;

        if (local && local.reconciled) {
            void logEvent({
                category: 'statement_parse',
                message: `Fatura parsed deterministically and reconciled (${local.transactions.length} transactions)`,
                metadata: { ...meta, parser: 'local-fatura', count: local.transactions.length, reconciled: true },
            });
            return { transactions: await categorize(local.transactions), faturaMeta: local.faturaMeta };
        }

        void logEvent({
            level: 'WARN',
            category: 'statement_parse',
            message: local
                ? 'Fatura local parse did not reconcile — falling back to AI'
                : 'Fatura layout unrecognized by local parser — falling back to AI',
            metadata: { ...meta, parser: 'local-fatura', localCount: local?.transactions.length ?? 0, reconciled: local?.reconciled ?? false },
        });

        const { transactions, faturaMeta } = await parseFaturaWithAI(file);
        if (transactions.length === 0) {
            void logEvent({
                level: 'WARN',
                category: 'statement_parse',
                message: 'No transactions extracted from fatura PDF',
                metadata: meta,
            });
            return { transactions: [], faturaMeta };
        }
        return { transactions: await categorize(transactions), faturaMeta };
    }

    const text = await extractPdfText(file);
    let transactions = text ? parseStatementText(text) : [];
    let parser: 'local' | 'ai' = 'local';

    // Reconcile against the statement's own Account summary totals. Informational
    // only — it does NOT gate the AI fallback (benign description drift must not
    // force every checking statement to a paid AI call).
    const recon = reconcileStatementText(text, transactions);
    void logEvent({
        category: 'statement_parse',
        message: 'Local PDF parse completed',
        metadata: {
            ...meta,
            count: transactions.length,
            reconciled: recon.reconciled,
            hasTotals: recon.hasTotals,
            expectedIncome: recon.expectedIncome,
            expectedExpense: recon.expectedExpense,
            actualIncome: recon.actualIncome,
            actualExpense: recon.actualExpense,
        },
    });

    if (transactions.length === 0) {
        void logEvent({
            level: 'WARN',
            category: 'statement_parse',
            message: 'Local parse found 0 transactions — falling back to AI',
            metadata: meta,
        });
        transactions = await parsePDFWithAI(file);
        parser = 'ai';
    }

    if (transactions.length === 0) {
        void logEvent({
            level: 'WARN',
            category: 'statement_parse',
            message: 'No transactions extracted from PDF',
            metadata: { ...meta, parser },
        });
        return { transactions: [], faturaMeta: null };
    }

    void logEvent({
        category: 'statement_parse',
        message: `Parsed ${transactions.length} transactions via ${parser} parser`,
        metadata: { ...meta, parser, count: transactions.length },
    });

    return { transactions: await categorize(transactions), faturaMeta: null };
}

// Categorize once, regardless of which parser produced the rows.
async function categorize(transactions: ParsedTransaction[]): Promise<ParsedTransaction[]> {
    const categorizationResults = await batchCategorize(
        transactions.map((t) => ({ description: t.description, amount: t.amount })),
    );
    return transactions.map((t, index) => ({
        ...t,
        categoryId: categorizationResults.get(index)?.categoryId ?? null,
    }));
}

/**
 * Deterministic, no-AI path: extract embedded text from the PDF and parse it
 * line-by-line. Returns [] for image-only PDFs (no extractable text) or layouts
 * the heuristics don't recognize.
 */
export async function parsePDFLocal(file: File): Promise<ParsedTransaction[]> {
    try {
        const buffer = await fileToBuffer(file);
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const { text } = await extractText(pdf, { mergePages: true });
        return parseStatementText(text);
    } catch (error) {
        console.error('Local PDF text extraction failed:', error);
        void logEvent({
            level: 'WARN',
            category: 'statement_parse',
            message: 'Local PDF text extraction failed',
            metadata: { fileName: file.name },
            error: serializeError(error),
        });
        return [];
    }
}

/**
 * AI fallback path: send the PDF to OpenRouter's file-parser plugin and ask the
 * model to return structured transactions. Requires a configured API key.
 */
export async function parsePDFWithAI(file: File): Promise<ParsedTransaction[]> {
    const { apiKey, model: modelId } = await getOpenRouterConfig();

    if (!apiKey) {
        void logEvent({
            level: 'ERROR',
            category: 'ai_call',
            message: 'AI PDF fallback unavailable — no OpenRouter API key configured',
            metadata: { fileName: file.name },
        });
        throw new Error(
            'Could not read this PDF automatically, and no OpenRouter API key is configured for the AI fallback. Add a key in Settings or upload a CSV.',
        );
    }

    const openrouter = createOpenRouter({ apiKey });
    const buffer = await fileToBuffer(file);
    const base64Data = buffer.toString('base64');

    const prompt = `You are a financial document parser. Analyze this bank statement PDF and extract all transactions.

For each transaction, extract:
- date: The transaction date (format: YYYY-MM-DD)
- description: The transaction description or merchant name
- amount: The transaction amount as a positive number
- type: Either "INCOME" for credits/deposits or "EXPENSE" for debits/withdrawals

Important rules:
1. Amounts should always be positive numbers
2. Credits, deposits, transfers IN should be marked as "INCOME"
3. Debits, withdrawals, payments, transfers OUT should be marked as "EXPENSE"
4. If you can't determine a value, skip that transaction
5. Parse dates in ISO format (YYYY-MM-DD)

Return ONLY a valid JSON array with no additional text or explanation:
[
  {
    "date": "2024-02-15",
    "description": "SUPERMARKET PURCHASE",
    "amount": 150.00,
    "type": "EXPENSE"
  },
  {
    "date": "2024-02-20",
    "description": "SALARY DEPOSIT",
    "amount": 5000.00,
    "type": "INCOME"
  }
]

If no transactions are found, return an empty array: []`;

    try {
        const { text } = await generateText({
            model: openrouter(modelId, {
                plugins: [{ id: 'file-parser', pdf: { engine: 'pdf-text' } }],
            }),
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'file',
                            data: base64Data,
                            mediaType: 'application/pdf',
                        },
                        { type: 'text', text: prompt },
                    ],
                },
            ],
        });

        // Extract JSON from the response (handle markdown code blocks)
        let jsonStr = text.trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }

        const transactions = JSON.parse(jsonStr);

        const parsed: ParsedTransaction[] = transactions
            .map((t: { date: string; description: string; amount: number | string; type: string }) => ({
                date: new Date(t.date),
                description: t.description,
                amount: Math.abs(typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount),
                type: (t.type.toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE') as 'INCOME' | 'EXPENSE',
            }))
            .filter((t: ParsedTransaction) => !isNaN(t.date.getTime()) && !isNaN(t.amount));

        void logEvent({
            category: 'ai_call',
            message: `AI PDF parse returned ${parsed.length} transactions`,
            metadata: { fileName: file.name, model: modelId, count: parsed.length },
        });

        return parsed;
    } catch (error) {
        console.error('Error parsing PDF with OpenRouter:', error);
        void logEvent({
            level: 'ERROR',
            category: 'ai_call',
            message: 'AI PDF parse failed',
            metadata: { fileName: file.name, model: modelId },
            error: serializeError(error),
        });
        throw new Error('Failed to process PDF. Please ensure the file is a valid bank statement.');
    }
}

// Strips markdown code fences and returns the raw JSON string.
function stripJsonFences(text: string): string {
    const trimmed = text.trim();
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    return match ? match[1].trim() : trimmed;
}

const FATURA_PROMPT = `You are a Brazilian credit-card statement (fatura) parser. Analyze this credit card PDF and extract BOTH the invoice metadata and every transaction line.

Return ONLY valid JSON (no markdown, no commentary) with this exact shape:
{
  "metadata": {
    "creditLimit": number | null,          // limite total / limite de crédito
    "availableLimit": number | null,        // limite disponível
    "closingDate": "YYYY-MM-DD" | null,      // data de fechamento
    "dueDate": "YYYY-MM-DD" | null,          // data de vencimento
    "totalAmount": number | null,            // valor total da fatura
    "minimumPayment": number | null,         // pagamento mínimo
    "previousBalance": number | null,        // saldo / fatura anterior
    "paymentsReceived": number | null,       // pagamentos e créditos recebidos
    "lastFour": string | null,               // últimos 4 dígitos do cartão
    "brand": string | null                   // bandeira (Visa, Mastercard, Elo...)
  },
  "transactions": [
    { "date": "YYYY-MM-DD", "description": "...", "amount": 150.00, "type": "EXPENSE" }
  ]
}

Rules:
1. Amounts are always positive numbers. Use a dot as the decimal separator.
2. type = "EXPENSE" for purchases/charges/fees/interest; type = "INCOME" for payments received, credits, refunds (estornos).
3. Keep installment markers in the description verbatim (e.g. "LOJA X 03/12", "PARC 03/12").
4. If a metadata value is not present, use null. Never invent values.
5. Dates in ISO format (YYYY-MM-DD).
6. If no transactions are found, return "transactions": [].`;

/**
 * Credit-card fatura AI path: returns structured transactions plus the invoice
 * metadata block (limit, closing/due dates, totals). Falls back gracefully —
 * if metadata validation fails, transactions are still returned.
 */
export async function parseFaturaWithAI(file: File): Promise<ParsePDFResult> {
    const { apiKey, model: modelId } = await getOpenRouterConfig();

    if (!apiKey) {
        void logEvent({
            level: 'ERROR',
            category: 'ai_call',
            message: 'Fatura AI parse unavailable — no OpenRouter API key configured',
            metadata: { fileName: file.name },
        });
        throw new Error(
            'Could not read this fatura automatically, and no OpenRouter API key is configured. Add a key in Settings or upload a CSV.',
        );
    }

    const openrouter = createOpenRouter({ apiKey });
    const buffer = await fileToBuffer(file);
    const base64Data = buffer.toString('base64');

    try {
        const { text } = await generateText({
            model: openrouter(modelId, {
                plugins: [{ id: 'file-parser', pdf: { engine: 'pdf-text' } }],
            }),
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'file', data: base64Data, mediaType: 'application/pdf' },
                        { type: 'text', text: FATURA_PROMPT },
                    ],
                },
            ],
        });

        const raw = JSON.parse(stripJsonFences(text));
        const result = faturaResponseSchema.safeParse(raw);

        if (!result.success) {
            void logEvent({
                level: 'WARN',
                category: 'ai_call',
                message: 'Fatura response failed schema validation',
                metadata: { fileName: file.name, model: modelId },
                error: serializeError(result.error),
            });
            return { transactions: [], faturaMeta: null };
        }

        const transactions: ParsedTransaction[] = result.data.transactions
            .map((t) => ({
                date: new Date(t.date),
                description: t.description,
                amount: Math.abs(typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount),
                type: (t.type.toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE') as 'INCOME' | 'EXPENSE',
            }))
            .filter((t) => !isNaN(t.date.getTime()) && !isNaN(t.amount));

        const faturaMeta: FaturaMeta | null = result.data.metadata
            ? { ...result.data.metadata }
            : null;

        void logEvent({
            category: 'ai_call',
            message: `Fatura AI parse returned ${transactions.length} transactions`,
            metadata: { fileName: file.name, model: modelId, count: transactions.length, hasMeta: !!faturaMeta },
        });

        return { transactions, faturaMeta };
    } catch (error) {
        console.error('Error parsing fatura with OpenRouter:', error);
        void logEvent({
            level: 'ERROR',
            category: 'ai_call',
            message: 'Fatura AI parse failed',
            metadata: { fileName: file.name, model: modelId },
            error: serializeError(error),
        });
        throw new Error('Failed to process fatura. Please ensure the file is a valid credit card statement.');
    }
}
