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
  get_credit_card_invoices: {
    type: 'object',
    properties: {
      accountId: { type: 'string', description: 'Filter invoices to one credit-card account' },
    },
  },
  get_invoice: {
    type: 'object',
    properties: {
      invoiceId: { type: 'string', description: 'Invoice ID to fetch' },
    },
    required: ['invoiceId'],
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

  // ---- Financial Journey Memory tools ----
  get_financial_journey_summary: {
    type: 'object',
    properties: {},
  },
  search_financial_memories: {
    type: 'object',
    properties: {
      memoryType:        { type: 'string', description: 'Filter by memory type' },
      status:            { type: 'string', description: 'Filter by status (defaults to active)' },
      q:                 { type: 'string', description: 'Keyword search in title/content' },
      relatedEntityType: { type: 'string', description: 'Filter by related entity type' },
      relatedEntityId:   { type: 'string', description: 'Filter by related entity id' },
      limit:             { type: 'number', description: 'Max results (default 20, max 100)', default: 20 },
    },
  },
  get_relevant_financial_context: {
    type: 'object',
    properties: {
      topic:      { type: 'string', description: 'Topic keyword to focus the context' },
      entityType: { type: 'string', description: 'Entity type to focus on (e.g., goal)' },
      entityId:   { type: 'string', description: 'Entity id to focus on' },
    },
  },
  list_open_financial_next_steps: {
    type: 'object',
    properties: {},
  },
  get_goal_memory_context: {
    type: 'object',
    properties: {
      goalId: { type: 'string', description: 'The goal id to fetch memory context for' },
    },
    required: ['goalId'],
  },
  create_financial_memory: {
    type: 'object',
    properties: {
      memoryType:        { type: 'string', description: 'decision | assumption | plan | goal | risk | preference | next_step | conversation_summary' },
      title:             { type: 'string', description: 'Short memory title' },
      content:           { type: 'string', description: 'Memory content' },
      confidence:        { type: 'number', description: 'Confidence 0-1' },
      priority:          { type: 'number', description: 'Priority (higher surfaces first)' },
      relatedEntityType: { type: 'string', description: 'Related entity type' },
      relatedEntityId:   { type: 'string', description: 'Related entity id' },
    },
    required: ['memoryType', 'title', 'content'],
  },
  propose_financial_memory: {
    type: 'object',
    properties: {
      proposedMemoryType: { type: 'string', description: 'Proposed memory type' },
      title:              { type: 'string', description: 'Short title' },
      content:            { type: 'string', description: 'Memory content' },
      confidence:         { type: 'number', description: 'Confidence 0-1' },
    },
    required: ['proposedMemoryType', 'title', 'content'],
  },
  update_financial_memory_status: {
    type: 'object',
    properties: {
      memoryId:       { type: 'string', description: 'Memory id' },
      status:         { type: 'string', description: 'active | archived | superseded | rejected | needs_review' },
      supersededById: { type: 'string', description: 'Id of the memory that replaces this one' },
    },
    required: ['memoryId', 'status'],
  },
  record_financial_decision: {
    type: 'object',
    properties: {
      title:             { type: 'string', description: 'Decision title' },
      content:           { type: 'string', description: 'Decision detail' },
      relatedEntityType: { type: 'string', description: 'Related entity type (e.g., goal)' },
      relatedEntityId:   { type: 'string', description: 'Related entity id' },
    },
    required: ['title', 'content'],
  },
  record_plan_update: {
    type: 'object',
    properties: {
      title:         { type: 'string', description: 'Plan title' },
      content:       { type: 'string', description: 'Plan detail or update' },
      relatedGoalId: { type: 'string', description: 'Related goal id' },
    },
    required: ['title', 'content'],
  },
};
