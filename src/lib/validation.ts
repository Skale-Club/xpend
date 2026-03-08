import { TransactionType, AccountType } from '@/types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Account validation
export function validateAccountData(data: {
  name?: unknown;
  type?: unknown;
  bank?: unknown;
  color?: unknown;
  initialBalance?: unknown;
  isActive?: unknown;
}) {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Account name is required');
  } else if (data.name.length > 100) {
    errors.push('Account name must be less than 100 characters');
  }

  const validAccountTypes: AccountType[] = ['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'OTHER'];
  if (!data.type || !validAccountTypes.includes(data.type as AccountType)) {
    errors.push('Valid account type is required (CHECKING, SAVINGS, CREDIT_CARD, DEBIT_CARD, CASH, OTHER)');
  }

  if (data.bank !== undefined && data.bank !== null && typeof data.bank !== 'string') {
    errors.push('Bank must be a string');
  }

  if (data.color && typeof data.color !== 'string') {
    errors.push('Color must be a valid hex color');
  }

  if (data.initialBalance !== undefined && data.initialBalance !== null) {
    const balance = Number(data.initialBalance);
    if (isNaN(balance)) {
      errors.push('Initial balance must be a number');
    }
  }

  if (data.isActive !== undefined && typeof data.isActive !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join(', '));
  }
}

// Transaction validation
export function validateTransactionUpdate(data: {
  id?: unknown;
  categoryId?: unknown;
  description?: unknown;
  notes?: unknown;
}) {
  const errors: string[] = [];

  if (!data.id || typeof data.id !== 'string' || data.id.trim().length === 0) {
    errors.push('Transaction ID is required');
  }

  if (data.categoryId !== null && data.categoryId !== undefined && typeof data.categoryId !== 'string') {
    errors.push('Category ID must be a string or null');
  }

  if (data.description !== undefined && (typeof data.description !== 'string' || data.description.trim().length === 0)) {
    errors.push('Description must be a non-empty string');
  }

  if (data.notes !== null && data.notes !== undefined && typeof data.notes !== 'string') {
    errors.push('Notes must be a string or null');
  } else if (data.notes && data.notes.length > 1000) {
    errors.push('Notes must be less than 1000 characters');
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join(', '));
  }
}

// Category validation
export function validateCategoryData(data: {
  name?: unknown;
  color?: unknown;
  icon?: unknown;
  parentId?: unknown;
}) {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Category name is required');
  } else if (data.name.length > 100) {
    errors.push('Category name must be less than 100 characters');
  }

  if (data.color && typeof data.color !== 'string') {
    errors.push('Color must be a string');
  }

  if (data.icon !== undefined && data.icon !== null && typeof data.icon !== 'string') {
    errors.push('Icon must be a string or null');
  }

  if (data.parentId !== undefined && data.parentId !== null && typeof data.parentId !== 'string') {
    errors.push('Parent ID must be a string or null');
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join(', '));
  }
}

// Statement upload validation
export function validateStatementUpload(data: {
  file?: unknown;
  accountId?: unknown;
  month?: unknown;
  year?: unknown;
}) {
  const errors: string[] = [];

  if (!data.file) {
    errors.push('File is required');
  }

  if (!data.accountId || typeof data.accountId !== 'string' || data.accountId.trim().length === 0) {
    errors.push('Account ID is required');
  }

  const month = Number(data.month);
  if (isNaN(month) || month < 1 || month > 12) {
    errors.push('Month must be between 1 and 12');
  }

  const year = Number(data.year);
  const currentYear = new Date().getFullYear();
  if (isNaN(year) || year < 2000 || year > currentYear + 1) {
    errors.push(`Year must be between 2000 and ${currentYear + 1}`);
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join(', '));
  }
}

// Settings validation
export function validateSettings(data: {
  geminiApiKey?: unknown;
}) {
  const errors: string[] = [];

  if (data.geminiApiKey !== undefined && data.geminiApiKey !== null) {
    if (typeof data.geminiApiKey !== 'string') {
      errors.push('Gemini API key must be a string');
    } else if (data.geminiApiKey.trim().length < 10) {
      errors.push('Gemini API key appears to be invalid (too short)');
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join(', '));
  }
}

// Query parameter validation
export function validateQueryParams(params: {
  accountId?: string | null;
  categoryId?: string | null;
  type?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  minAmount?: string | null;
  maxAmount?: string | null;
  limit?: string | null;
  offset?: string | null;
}) {
  const errors: string[] = [];

  const validTransactionTypes: TransactionType[] = ['INCOME', 'EXPENSE', 'TRANSFER'];
  if (params.type && !validTransactionTypes.includes(params.type as TransactionType)) {
    errors.push('Type must be INCOME, EXPENSE, or TRANSFER');
  }

  if (params.dateFrom) {
    const date = new Date(params.dateFrom);
    if (isNaN(date.getTime())) {
      errors.push('Invalid dateFrom format');
    }
  }

  if (params.dateTo) {
    const date = new Date(params.dateTo);
    if (isNaN(date.getTime())) {
      errors.push('Invalid dateTo format');
    }
  }

  if (params.minAmount) {
    const amount = Number(params.minAmount);
    if (isNaN(amount) || amount < 0) {
      errors.push('minAmount must be a positive number');
    }
  }

  if (params.maxAmount) {
    const amount = Number(params.maxAmount);
    if (isNaN(amount) || amount < 0) {
      errors.push('maxAmount must be a positive number');
    }
  }

  if (params.limit) {
    const limit = Number(params.limit);
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      errors.push('limit must be between 1 and 1000');
    }
  }

  if (params.offset) {
    const offset = Number(params.offset);
    if (isNaN(offset) || offset < 0) {
      errors.push('offset must be a positive number');
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join(', '));
  }
}
