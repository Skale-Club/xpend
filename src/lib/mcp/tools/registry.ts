import * as reads from './reads';
import * as writes from './writes';
import * as memory from './memory';

export type ToolName =
  | 'get_transactions'
  | 'get_accounts'
  | 'get_categories'
  | 'get_subscriptions'
  | 'get_goals'
  | 'get_dashboard_summary'
  | 'get_category_breakdown'
  | 'get_credit_card_invoices'
  | 'get_invoice'
  | 'categorize_transaction'
  | 'update_transaction_notes'
  | 'mark_transaction_recurring'
  | 'categorize_by_description'
  | 'create_categorization_rule'
  | 'create_goal'
  | 'update_goal'
  | 'delete_goal'
  | 'add_goal_contribution'
  | 'get_financial_journey_summary'
  | 'search_financial_memories'
  | 'get_relevant_financial_context'
  | 'list_open_financial_next_steps'
  | 'get_goal_memory_context'
  | 'create_financial_memory'
  | 'propose_financial_memory'
  | 'update_financial_memory_status'
  | 'record_financial_decision'
  | 'record_plan_update';

export const READ_TOOLS: ToolName[] = [
  'get_transactions',
  'get_accounts',
  'get_categories',
  'get_subscriptions',
  'get_goals',
  'get_dashboard_summary',
  'get_category_breakdown',
  'get_credit_card_invoices',
  'get_invoice',
  'get_financial_journey_summary',
  'search_financial_memories',
  'get_relevant_financial_context',
  'list_open_financial_next_steps',
  'get_goal_memory_context',
];

export const WRITE_TOOLS: ToolName[] = [
  'categorize_transaction',
  'update_transaction_notes',
  'mark_transaction_recurring',
  'categorize_by_description',
  'create_categorization_rule',
  'create_goal',
  'update_goal',
  'delete_goal',
  'add_goal_contribution',
  'create_financial_memory',
  'propose_financial_memory',
  'update_financial_memory_status',
  'record_financial_decision',
  'record_plan_update',
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
    description: 'List all active accounts with current balance. Credit cards also include creditLimit, availableLimit, closingDay and dueDay.',
    params: {},
  },
  get_credit_card_invoices: {
    description: 'List credit-card invoices (faturas), newest first. Optionally filter by account.',
    params: {
      accountId: 'string (optional) — filter invoices to one credit-card account',
    },
  },
  get_invoice: {
    description: 'Get a single credit-card invoice with its transactions and installment markers.',
    params: {
      invoiceId: 'string (required)',
    },
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
  get_goals: {
    description: 'List financial goals with progress (currentAmount, remaining, percentComplete). Optionally filter by status or type.',
    params: {
      status: '"DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED" (optional)',
      type: '"SAVINGS" | "TRAVEL" | "DEBT_PAYOFF" | "PURCHASE" | "EMERGENCY_FUND" (optional)',
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
  create_goal: {
    description: 'Create a financial goal (savings, travel, debt payoff, purchase, or emergency fund). For DEBT_PAYOFF goals, set targetAmount to the balance owed and optionally interestRate/minimumPayment. Use get_accounts first if you want to link the goal to an account via linkedAccountId.',
    params: {
      name: 'string (required)',
      type: '"SAVINGS" | "TRAVEL" | "DEBT_PAYOFF" | "PURCHASE" | "EMERGENCY_FUND" (required)',
      targetAmount: 'number (required) — target/savings amount or balance owed for debt',
      currentAmount: 'number (optional, default 0) — amount already saved/paid',
      status: '"DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED" (default ACTIVE)',
      priority: '"LOW" | "MEDIUM" | "HIGH" (default MEDIUM)',
      targetDate: 'string (YYYY-MM-DD, optional) — deadline',
      interestRate: 'number (optional) — annual % for DEBT_PAYOFF',
      minimumPayment: 'number (optional) — minimum monthly payment for DEBT_PAYOFF',
      monthsOfCoverage: 'number (optional) — months of expenses for EMERGENCY_FUND',
      description: 'string (optional)',
      linkedAccountId: 'string (optional) — link to an account',
      linkedCategoryId: 'string (optional) — link to a category',
    },
  },
  update_goal: {
    description: 'Update fields of an existing goal. Partial — only the fields you pass are changed. Use get_goals to find the goalId.',
    params: {
      goalId: 'string (required)',
      name: 'string (optional)',
      type: '"SAVINGS" | "TRAVEL" | "DEBT_PAYOFF" | "PURCHASE" | "EMERGENCY_FUND" (optional)',
      targetAmount: 'number (optional)',
      currentAmount: 'number (optional) — sets the absolute saved/paid amount (use add_goal_contribution to log incremental progress)',
      status: '"DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED" (optional)',
      priority: '"LOW" | "MEDIUM" | "HIGH" (optional)',
      targetDate: 'string (YYYY-MM-DD) | null (optional)',
      interestRate: 'number | null (optional)',
      minimumPayment: 'number | null (optional)',
      monthsOfCoverage: 'number | null (optional)',
      description: 'string | null (optional)',
      linkedAccountId: 'string | null (optional)',
      linkedCategoryId: 'string | null (optional)',
    },
  },
  delete_goal: {
    description: 'Permanently delete a goal and its contributions/plans/scenarios. Use get_goals to find the goalId.',
    params: {
      goalId: 'string (required)',
    },
  },
  add_goal_contribution: {
    description: 'Record a contribution/payment toward a goal. Increments the goal currentAmount atomically. For debt-payoff goals this logs a payment made; for savings goals it logs money set aside.',
    params: {
      goalId: 'string (required)',
      amount: 'number (required, > 0)',
      date: 'string (YYYY-MM-DD, optional, default today)',
      accountId: 'string (optional) — source account',
      transactionId: 'string (optional) — link to a transaction',
      note: 'string (optional)',
    },
  },
  get_financial_journey_summary: {
    description: 'Get the user financial journey summary, current focus, and memory counts.',
    params: {},
  },
  search_financial_memories: {
    description: 'Search durable financial memories (decisions, assumptions, plans, risks, preferences, next steps).',
    params: {
      memoryType: 'string (optional)',
      status: 'string (optional, defaults to active)',
      q: 'string (optional) — keyword search in title/content',
      relatedEntityType: 'string (optional)',
      relatedEntityId: 'string (optional)',
      limit: 'number (default 20, max 100)',
    },
  },
  get_relevant_financial_context: {
    description: 'Get a compact, ranked financial-context package for planning, optionally focused on a topic or entity.',
    params: {
      topic: 'string (optional)',
      entityType: 'string (optional)',
      entityId: 'string (optional)',
    },
  },
  list_open_financial_next_steps: {
    description: 'List open (active) financial next-step memories.',
    params: {},
  },
  get_goal_memory_context: {
    description: 'Get memories and context related to a specific goal.',
    params: { goalId: 'string (required)' },
  },
  create_financial_memory: {
    description: 'Create a durable financial memory directly (active). Use propose_financial_memory when user confirmation is preferred.',
    params: {
      memoryType: 'string (required): decision | assumption | plan | goal | risk | preference | next_step | conversation_summary',
      title: 'string (required)',
      content: 'string (required)',
      confidence: 'number 0-1 (optional)',
      priority: 'number (optional)',
      relatedEntityType: 'string (optional)',
      relatedEntityId: 'string (optional)',
    },
  },
  propose_financial_memory: {
    description: 'Propose a memory for user review instead of saving it directly. Lands in the review queue.',
    params: {
      proposedMemoryType: 'string (required)',
      title: 'string (required)',
      content: 'string (required)',
      confidence: 'number 0-1 (optional)',
    },
  },
  update_financial_memory_status: {
    description: 'Update a memory status (active, archived, superseded, rejected, needs_review).',
    params: {
      memoryId: 'string (required)',
      status: 'string (required)',
      supersededById: 'string (optional) — the memory that replaces this one',
    },
  },
  record_financial_decision: {
    description: 'Record a financial decision as a durable memory and a journey timeline entry.',
    params: {
      title: 'string (required)',
      content: 'string (required)',
      relatedEntityType: 'string (optional)',
      relatedEntityId: 'string (optional)',
    },
  },
  record_plan_update: {
    description: 'Record a plan or plan update as a durable memory and a journey timeline entry.',
    params: {
      title: 'string (required)',
      content: 'string (required)',
      relatedGoalId: 'string (optional)',
    },
  },
};

type AnyParams = Record<string, unknown>;

const HANDLERS: Record<ToolName, (params: AnyParams) => Promise<unknown>> = {
  get_transactions: (p) => reads.get_transactions(p as Parameters<typeof reads.get_transactions>[0]),
  get_accounts: (p) => reads.get_accounts(p as never),
  get_categories: (p) => reads.get_categories(p as never),
  get_subscriptions: (p) => reads.get_subscriptions(p as Parameters<typeof reads.get_subscriptions>[0]),
  get_goals: (p) => reads.get_goals(p as Parameters<typeof reads.get_goals>[0]),
  get_dashboard_summary: (p) => reads.get_dashboard_summary(p as Parameters<typeof reads.get_dashboard_summary>[0]),
  get_category_breakdown: (p) => reads.get_category_breakdown(p as Parameters<typeof reads.get_category_breakdown>[0]),
  get_credit_card_invoices: (p) => reads.get_credit_card_invoices(p as Parameters<typeof reads.get_credit_card_invoices>[0]),
  get_invoice: (p) => reads.get_invoice(p as Parameters<typeof reads.get_invoice>[0]),
  categorize_transaction: (p) => writes.categorize_transaction(p as Parameters<typeof writes.categorize_transaction>[0]),
  update_transaction_notes: (p) => writes.update_transaction_notes(p as Parameters<typeof writes.update_transaction_notes>[0]),
  mark_transaction_recurring: (p) => writes.mark_transaction_recurring(p as Parameters<typeof writes.mark_transaction_recurring>[0]),
  categorize_by_description: (p) => writes.categorize_by_description(p as Parameters<typeof writes.categorize_by_description>[0]),
  create_categorization_rule: (p) => writes.create_categorization_rule(p as Parameters<typeof writes.create_categorization_rule>[0]),
  create_goal: (p) => writes.create_goal(p as Parameters<typeof writes.create_goal>[0]),
  update_goal: (p) => writes.update_goal(p as Parameters<typeof writes.update_goal>[0]),
  delete_goal: (p) => writes.delete_goal(p as Parameters<typeof writes.delete_goal>[0]),
  add_goal_contribution: (p) => writes.add_goal_contribution(p as Parameters<typeof writes.add_goal_contribution>[0]),
  get_financial_journey_summary: () => memory.get_financial_journey_summary(),
  search_financial_memories: (p) => memory.search_financial_memories(p as Parameters<typeof memory.search_financial_memories>[0]),
  get_relevant_financial_context: (p) => memory.get_relevant_financial_context(p as Parameters<typeof memory.get_relevant_financial_context>[0]),
  list_open_financial_next_steps: () => memory.list_open_financial_next_steps(),
  get_goal_memory_context: (p) => memory.get_goal_memory_context(p as Parameters<typeof memory.get_goal_memory_context>[0]),
  create_financial_memory: (p) => memory.create_financial_memory(p as Parameters<typeof memory.create_financial_memory>[0]),
  propose_financial_memory: (p) => memory.propose_financial_memory(p as Parameters<typeof memory.propose_financial_memory>[0]),
  update_financial_memory_status: (p) => memory.update_financial_memory_status(p as Parameters<typeof memory.update_financial_memory_status>[0]),
  record_financial_decision: (p) => memory.record_financial_decision(p as Parameters<typeof memory.record_financial_decision>[0]),
  record_plan_update: (p) => memory.record_plan_update(p as Parameters<typeof memory.record_plan_update>[0]),
};

export function isValidTool(name: string): name is ToolName {
  return ALL_TOOLS.includes(name as ToolName);
}

export async function executeTool(name: ToolName, params: AnyParams): Promise<unknown> {
  return HANDLERS[name](params);
}
