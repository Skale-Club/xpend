type JsonSchema = {
  type: string;
  properties?: Record<string, { type: string | string[]; description?: string; enum?: string[]; default?: unknown; pattern?: string }>;
  required?: string[];
};

export const INPUT_SCHEMAS: Record<string, JsonSchema> = {
  get_transactions: {
    type: 'object',
    properties: {
      dateFrom:   { type: 'string',  description: 'Start date (YYYY-MM-DD)', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      dateTo:     { type: 'string',  description: 'End date (YYYY-MM-DD)',   pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      accountId:  { type: 'string',  description: 'Filter by account ID' },
      categoryId: { type: 'string',  description: 'Filter by category ID' },
      minAmount:  { type: 'number',  description: 'Minimum amount' },
      maxAmount:  { type: 'number',  description: 'Maximum amount' },
      search:     { type: 'string',  description: 'Search in description or notes' },
      limit:      { type: 'number',  description: 'Max results (default 50, max 200)', default: 50 },
      offset:     { type: 'number',  description: 'Pagination offset', default: 0 },
    },
  },
  get_accounts: {
    type: 'object',
    properties: {},
  },
  get_categories: {
    type: 'object',
    properties: {},
  },
  get_subscriptions: {
    type: 'object',
    properties: {
      inactive:     { type: 'boolean', description: 'Filter by inactive status' },
      includeStats: { type: 'boolean', description: 'Include monthly/yearly cost stats' },
    },
  },
  get_dashboard_summary: {
    type: 'object',
    properties: {
      dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
      dateTo:   { type: 'string', description: 'End date (YYYY-MM-DD)' },
    },
  },
  get_category_breakdown: {
    type: 'object',
    properties: {
      dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
      dateTo:   { type: 'string', description: 'End date (YYYY-MM-DD)' },
      type:     { type: 'string', description: 'Transaction type', enum: ['INCOME', 'EXPENSE'], default: 'EXPENSE' },
    },
  },
  categorize_transaction: {
    type: 'object',
    properties: {
      transactionId: { type: 'string',           description: 'Transaction ID to update' },
      categoryId:    { type: ['string', 'null'],  description: 'Category ID to assign (null to clear)' },
    },
    required: ['transactionId', 'categoryId'],
  },
  update_transaction_notes: {
    type: 'object',
    properties: {
      transactionId: { type: 'string',           description: 'Transaction ID to update' },
      notes:         { type: ['string', 'null'],  description: 'Notes to set (null to clear)' },
    },
    required: ['transactionId', 'notes'],
  },
  mark_transaction_recurring: {
    type: 'object',
    properties: {
      transactionId: { type: 'string',  description: 'Transaction ID to update' },
      isRecurring:   { type: 'boolean', description: 'Whether the transaction is recurring' },
    },
    required: ['transactionId', 'isRecurring'],
  },
  categorize_by_description: {
    type: 'object',
    properties: {
      searchPattern:   { type: 'string', description: 'Text pattern to match in descriptions' },
      categoryId:      { type: 'string', description: 'Category ID to assign' },
      maxTransactions: { type: 'number', description: 'Max transactions to update (default 50, max 200)', default: 50 },
    },
    required: ['searchPattern', 'categoryId'],
  },
  create_categorization_rule: {
    type: 'object',
    properties: {
      keywords:  { type: 'string', description: 'Keywords to match in descriptions' },
      categoryId:{ type: 'string', description: 'Category ID to assign when matched' },
      matchType: { type: 'string', description: 'Match type', enum: ['exact', 'contains', 'regex'], default: 'contains' },
    },
    required: ['keywords', 'categoryId'],
  },
};
