import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { prisma } from './db';
import { batchCategorize } from './autoCategorize';
import { DEFAULT_CHAT_MODEL } from './chat/models';

export interface ParsedTransaction {
    date: Date;
    description: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    categoryId?: string | null;
}

// Get API key and configured chat model from database
async function getOpenRouterConfig(): Promise<{ apiKey: string; model: string }> {
    const settings = await prisma.settings.findUnique({
        where: { id: 'default' },
        select: { geminiApiKey: true, geminiChatModel: true },
    });

    if (!settings?.geminiApiKey) {
        throw new Error('OpenRouter API key not configured. Please configure your key in Settings.');
    }

    return {
        apiKey: settings.geminiApiKey,
        model: settings.geminiChatModel || DEFAULT_CHAT_MODEL,
    };
}

export async function parsePDF(file: File): Promise<ParsedTransaction[]> {
    const { apiKey, model: modelId } = await getOpenRouterConfig();
    const openrouter = createOpenRouter({ apiKey });

    // Convert File to ArrayBuffer and then to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

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

        // Remove markdown code blocks if present
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }

        // Parse the JSON response
        const transactions = JSON.parse(jsonStr);

        // Validate and transform the transactions
        const parsedTransactions: ParsedTransaction[] = transactions.map((t: { date: string; description: string; amount: number | string; type: string }) => ({
            date: new Date(t.date),
            description: t.description,
            amount: Math.abs(typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount),
            type: t.type.toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE' as 'INCOME' | 'EXPENSE',
        })).filter((t: ParsedTransaction) => !isNaN(t.date.getTime()) && !isNaN(t.amount));

        // Auto-categorize transactions using rules
        const categorizationResults = await batchCategorize(
            parsedTransactions.map((t: ParsedTransaction) => ({ description: t.description, amount: t.amount }))
        );

        // Apply categorization results
        return parsedTransactions.map((t: ParsedTransaction, index: number) => ({
            ...t,
            categoryId: categorizationResults.get(index)?.categoryId || null,
        }));
    } catch (error) {
        console.error('Error parsing PDF with OpenRouter:', error);
        throw new Error('Failed to process PDF. Please ensure the file is a valid bank statement.');
    }
}
