// Allowed values for the memory system's string discriminator fields. Kept here
// (not as Prisma enums) so they can be shared by client and server and evolve
// across phases without migrations. Validation references these sets.

export const MEMORY_TYPES = [
  'decision',
  'assumption',
  'plan',
  'goal',
  'risk',
  'preference',
  'next_step',
  'conversation_summary',
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_STATUSES = ['active', 'archived', 'superseded', 'rejected', 'needs_review'] as const;
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export const MEMORY_SOURCES = ['chat', 'mcp', 'manual', 'system', 'import'] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];

export const ENTRY_TYPES = [
  'conversation_summary',
  'decision',
  'assumption',
  'plan',
  'recommendation',
  'rejected_recommendation',
  'risk',
  'preference',
  'next_step',
  'status_update',
] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const IMPORTANCE_LEVELS = ['low', 'medium', 'high'] as const;
export type ImportanceLevel = (typeof IMPORTANCE_LEVELS)[number];

export const ENTITY_TYPES = [
  'goal',
  'plan',
  'scenario',
  'transaction',
  'account',
  'category',
  'subscription',
  'chat_session',
  'journey_entry',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const RELATIONSHIP_TYPES = [
  'explains',
  'supports',
  'conflicts_with',
  'supersedes',
  'originated_from',
  'relates_to',
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'edited'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface FinancialJourney {
  id: string;
  title: string;
  status: string;
  summary?: string | null;
  currentFocus?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  entries?: JourneyEntry[];
}

export interface JourneyEntry {
  id: string;
  journeyId: string;
  entryType: string;
  title: string;
  summary?: string | null;
  source: string;
  sourceSessionId?: string | null;
  relatedGoalId?: string | null;
  relatedPlanId?: string | null;
  relatedTransactionId?: string | null;
  relatedAccountId?: string | null;
  importance: string;
  confidence?: number | null;
  tags: string[];
  happenedAt: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface MemoryLink {
  id: string;
  memoryId: string;
  entityType: string;
  entityId: string;
  relationshipType: string;
  createdAt: string | Date;
}

export interface FinancialMemory {
  id: string;
  memoryType: string;
  title: string;
  content: string;
  normalizedContent?: string | null;
  status: string;
  source: string;
  sourceSessionId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  confidence?: number | null;
  priority: number;
  validFrom: string | Date;
  validUntil?: string | Date | null;
  supersededById?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  links?: MemoryLink[];
}

export interface MemoryReviewItem {
  id: string;
  proposedMemoryType: string;
  title: string;
  content: string;
  extractedFromSessionId?: string | null;
  confidence?: number | null;
  status: string;
  createdAt: string | Date;
  reviewedAt?: string | Date | null;
}

// Display labels.
export const MEMORY_TYPE_LABELS: Record<string, string> = {
  decision: 'Decision',
  assumption: 'Assumption',
  plan: 'Plan',
  goal: 'Goal',
  risk: 'Risk',
  preference: 'Preference',
  next_step: 'Next Step',
  conversation_summary: 'Conversation Summary',
  recommendation: 'Recommendation',
  rejected_recommendation: 'Rejected Recommendation',
  status_update: 'Status Update',
};

export const MEMORY_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  archived: 'Archived',
  superseded: 'Superseded',
  rejected: 'Rejected',
  needs_review: 'Needs Review',
};

export const MEMORY_SOURCE_LABELS: Record<string, string> = {
  chat: 'Chat',
  mcp: 'MCP',
  manual: 'Manual',
  system: 'System',
  import: 'Import',
};
