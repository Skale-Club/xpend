import { prisma } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface CategorizationResult {
    categoryId: string | null;
    categoryName: string | null;
    confidence: number;
    matchedRule?: string;
    source: 'rule' | 'ai' | 'none';
}

export interface CategorizationRule {
    id: string;
    categoryId: string;
    keywords: string;
    matchType: string;
    priority: number;
    category: {
        id: string;
        name: string;
        color: string;
        icon: string | null;
    };
}

/**
 * Get all active categorization rules, sorted by priority
 */
export async function getCategorizationRules(): Promise<CategorizationRule[]> {
    const rules = await prisma.categorizationRule.findMany({
        where: { isActive: true },
        include: {
            category: {
                select: { id: true, name: true, color: true, icon: true },
            },
        },
        orderBy: [
            { priority: 'desc' },
            { createdAt: 'asc' },
        ],
    });

    return rules;
}

/**
 * Check if a description matches a rule
 */
function matchesRule(description: string, rule: CategorizationRule): boolean {
    const desc = description.toLowerCase();
    const keywords = rule.keywords.toLowerCase();

    switch (rule.matchType) {
        case 'exact':
            return desc === keywords;
        case 'regex':
            try {
                const regex = new RegExp(keywords, 'i');
                return regex.test(desc);
            } catch {
                return false;
            }
        case 'contains':
        default:
            return desc.includes(keywords);
    }
}

/**
 * Find matching category based on rules
 */
export function matchByRules(
    description: string,
    rules: CategorizationRule[]
): CategorizationResult | null {
    for (const rule of rules) {
        if (matchesRule(description, rule)) {
            return {
                categoryId: rule.categoryId,
                categoryName: rule.category.name,
                confidence: 0.95,
                matchedRule: rule.keywords,
                source: 'rule',
            };
        }
    }

    return null;
}

/**
 * Get AI-powered category suggestion using Gemini
 */
export async function suggestByAI(
    description: string,
    amount: number,
    categories: { id: string; name: string }[]
): Promise<CategorizationResult | null> {
    try {
        // Get API key from settings
        const settings = await prisma.settings.findUnique({
            where: { id: 'default' },
        });

        if (!settings?.geminiApiKey) {
            return null;
        }

        const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const categoryList = categories.map((c) => c.name).join(', ');

        const prompt = `You are a financial transaction categorizer. Given the following transaction description and amount, suggest the most appropriate category from the provided list.

Transaction Description: "${description}"
Amount: $${amount.toFixed(2)}

Available Categories: ${categoryList}

Instructions:
1. Choose the SINGLE most appropriate category from the list
2. If unsure, choose "Other Expenses" or "Other Income" based on the amount sign
3. Respond with ONLY the category name, nothing else

Category:`;

        const result = await model.generateContent(prompt);
        const response = result.response.text().trim();

        // Find matching category
        const matchedCategory = categories.find(
            (c) => c.name.toLowerCase() === response.toLowerCase()
        );

        if (matchedCategory) {
            return {
                categoryId: matchedCategory.id,
                categoryName: matchedCategory.name,
                confidence: 0.7,
                source: 'ai',
            };
        }

        return null;
    } catch (error) {
        console.error('AI categorization error:', error);
        return null;
    }
}

/**
 * Main auto-categorization function
 * 1. First tries to match by user-defined rules (highest priority)
 * 2. Falls back to AI suggestion if no rule matches
 * 3. Returns null if both fail
 */
export async function autoCategorize(
    description: string,
    amount: number
): Promise<CategorizationResult> {
    // Get all rules and categories
    const [rules, categories] = await Promise.all([
        getCategorizationRules(),
        prisma.category.findMany({
            select: { id: true, name: true },
        }),
    ]);

    // 1. Try rule-based matching first
    const ruleMatch = matchByRules(description, rules);
    if (ruleMatch) {
        return ruleMatch;
    }

    // 2. Try AI suggestion
    const aiMatch = await suggestByAI(description, amount, categories);
    if (aiMatch) {
        return aiMatch;
    }

    // 3. No match found
    return {
        categoryId: null,
        categoryName: null,
        confidence: 0,
        source: 'none',
    };
}

/**
 * Batch categorize multiple transactions
 */
export async function batchCategorize(
    transactions: { description: string; amount: number }[]
): Promise<Map<number, CategorizationResult>> {
    const results = new Map<number, CategorizationResult>();

    // Get all rules and categories once
    const [rules, categories] = await Promise.all([
        getCategorizationRules(),
        prisma.category.findMany({
            select: { id: true, name: true },
        }),
    ]);

    for (let i = 0; i < transactions.length; i++) {
        const { description, amount } = transactions[i];

        // Try rule-based matching first
        const ruleMatch = matchByRules(description, rules);
        if (ruleMatch) {
            results.set(i, ruleMatch);
            continue;
        }

        // For batch operations, skip AI to avoid rate limits
        // AI can be used for individual transactions
        results.set(i, {
            categoryId: null,
            categoryName: null,
            confidence: 0,
            source: 'none',
        });
    }

    return results;
}

/**
 * Learn from user correction - create a new rule
 */
export async function learnFromCorrection(
    description: string,
    categoryId: string
): Promise<void> {
    // Extract key words from description
    const words = description.toLowerCase().split(/\s+/);

    // Filter out common words and keep meaningful ones
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const meaningfulWords = words.filter(
        (word) => word.length > 2 && !stopWords.includes(word) && !/^\d+$/.test(word)
    );

    if (meaningfulWords.length > 0) {
        // Create a rule with the most meaningful word
        const keyword = meaningfulWords[0];

        // Check if rule already exists
        const existingRule = await prisma.categorizationRule.findFirst({
            where: {
                categoryId,
                keywords: keyword,
            },
        });

        if (!existingRule) {
            await prisma.categorizationRule.create({
                data: {
                    categoryId,
                    keywords: keyword,
                    matchType: 'contains',
                    priority: 1, // Low priority for auto-learned rules
                    isActive: true,
                },
            });
        }
    }
}
