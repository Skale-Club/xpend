export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'OTHER';
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  bank?: string | null;
  color: string;
  icon?: string | null;
  initialBalance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Statement {
  id: string;
  accountId: string;
  month: number;
  year: number;
  fileName: string;
  fileUrl?: string | null;
  uploadedAt: Date;
}

export interface Transaction {
  id: string;
  accountId: string;
  statementId?: string | null;
  categoryId?: string | null;
  type: TransactionType;
  amount: number;
  description: string;
  date: Date;
  isRecurring: boolean;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  category?: { id: string; name: string; color: string } | null;
  account?: { name: string; color: string };
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
  parentId?: string | null;
}

export interface DashboardFilters {
  dateFrom?: Date;
  dateTo?: Date;
  accountIds?: string[];
  categoryIds?: string[];
  transactionType?: TransactionType;
  minAmount?: number;
  maxAmount?: number;
  searchQuery?: string;
}

export interface MonthlyData {
  month: string;
  year: number;
  income: number;
  expenses: number;
  balance: number;
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  color: string;
  total: number;
  percentage: number;
  count: number;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: 'Checking Account',
  SAVINGS: 'Savings Account',
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  CASH: 'Cash',
  OTHER: 'Other',
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  CHECKING: 'Building2',
  SAVINGS: 'PiggyBank',
  CREDIT_CARD: 'CreditCard',
  DEBIT_CARD: 'Smartphone',
  CASH: 'Wallet',
  OTHER: 'CircleDollarSign',
};
