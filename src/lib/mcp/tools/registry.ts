import * as reads from './reads';
import * as writes from './writes';

export type ToolName =
  | 'get_transactions'
  | 'get_accounts'
  | 'get_categories'
  | 'get_subscriptions'
  | 'get_dashboard_summary'
  | 'get_category_breakdown'
  | 'categorize_transaction'
  | 'update_transaction_notes'
  | 'mark_transaction_recurring'
  | 'categorize_by_description'
  | 'create_categorization_rule';

export const READ_TOOLS: ToolName[] = [
  'get_transactions',
  'get_accounts',
  'get_categories',
  'get_subscriptions',
  'get_dashboard_summary',
  'get_category_breakdown',
];

export const WRITE_TOOLS: ToolName[] = [
  'categorize_transaction',
  'update_transaction_notes',
  'mark_transaction_recurring',
  'categorize_by_description',
  'create_categorization_rule',
];

export const ALL_TOOLS: ToolName[] = [...READ_TOOLS, ...WRITE_TOOLS];

export const TOOL_DESCRIPTIONS: Record<ToolName, { description: string; params: object }> = {
  get_transactions: {
    description: 'List transactions with optional filters.',
    params: {
      dateFrom: 'string (YYYY-MM-DD, optional)',
      dateTo: 'string (YYYY-MM-DD, optional)',
      accountId: 'string (optional)',
      categoryId: 'string (optional)',
      minAmount: 'number (optional)',
      maxAmount: 'number (optional)',
      search: 'string (optional)',
      limit: 'number (default 50, max 200)',
      offset: 'number (default 0)',
    },
  },
  get_accounts: {
    description: 'List all active accounts with current balance.',
    params: {},
  },
  get_categories: {
    description: 'List all categories with hierarchy info.',
    params: {},
  },
  get_subscriptions: {
    description: 'List subscriptions.',
    params: {
      inactive: 'boolean (optional) — filter by active/inactive',
      includeStats: 'boolean (optional) — include monthly/yearly cost stats',
    },
  },
  get_dashboard_summary: {
    description: 'Get total income, expenses, net balance and monthly trends.',
    params: {
      dateFrom: 'string (YYYY-MM-DD, optional)',
      dateTo: 'string (YYYY-MM-DD, optional)',
    },
  },
  get_category_breakdown: {
    description: 'Get spending breakdown by category.',
    params: {
      dateFrom: 'string (YYYY-MM-DD, optional)',
      dateTo: 'string (YYYY-MM-DD, optional)',
      type: '"INCOME" | "EXPENSE" (default "EXPENSE")',
    },
  },
  categorize_transaction: {
    description: 'Set or clear the category of a transaction.',
    params: {
      transactionId: 'string (required)',
      categoryId: 'string | null (required)',
    },
  },
  update_transaction_notes: {
    description: 'Add or update notes on a transaction.',
    params: {
      transactionId: 'string (required)',
      notes: 'string | null (required)',
    },
  },
  mark_transaction_recurring: {
    description: 'Mark a transaction as recurring or not.',
    params: {
      transactionId: 'string (required)',
      isRecurring: 'boolean (required)',
    },
  },
  categorize_by_description: {
    description: 'Bulk-categorize transactions matching a description pattern.',
    params: {
      searchPattern: 'string (required)',
      categoryId: 'string (required)',
      maxTransactions: 'number (default 50, max 200)',
    },
  },
  create_categorization_rule: {
    description: 'Create a new auto-categorization rule.',
    params: {
      keywords: 'string (required)',
      categoryId: 'string (required)',
      matchType: '"exact" | "contains" | "regex" (default "contains")',
    },
  },
};

type AnyParams = Record<string, unknown>;

const HANDLERS: Record<ToolName, (params: AnyParams) => Promise<unknown>> = {
  get_transactions: (p) => reads.get_transactions(p as Parameters<typeof reads.get_transactions>[0]),
  get_accounts: (p) => reads.get_accounts(p as never),
  get_categories: (p) => reads.get_categories(p as never),
  get_subscriptions: (p) => reads.get_subscriptions(p as Parameters<typeof reads.get_subscriptions>[0]),
  get_dashboard_summary: (p) => reads.get_dashboard_summary(p as Parameters<typeof reads.get_dashboard_summary>[0]),
  get_category_breakdown: (p) => reads.get_category_breakdown(p as Parameters<typeof reads.get_category_breakdown>[0]),
  categorize_transaction: (p) => writes.categorize_transaction(p as Parameters<typeof writes.categorize_transaction>[0]),
  update_transaction_notes: (p) => writes.update_transaction_notes(p as Parameters<typeof writes.update_transaction_notes>[0]),
  mark_transaction_recurring: (p) => writes.mark_transaction_recurring(p as Parameters<typeof writes.mark_transaction_recurring>[0]),
  categorize_by_description: (p) => writes.categorize_by_description(p as Parameters<typeof writes.categorize_by_description>[0]),
  create_categorization_rule: (p) => writes.create_categorization_rule(p as Parameters<typeof writes.create_categorization_rule>[0]),
};

export function isValidTool(name: string): name is ToolName {
  return ALL_TOOLS.includes(name as ToolName);
}

export async function executeTool(name: ToolName, params: AnyParams): Promise<unknown> {
  return HANDLERS[name](params);
}
