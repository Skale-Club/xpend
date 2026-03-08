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
  category?: { id: string; name: string; color: string; icon?: string | null } | null;
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

// Unified distribution data for DistributionCarousel
export interface DistributionItem {
  id?: string;
  name: string;
  amount: number;
  color: string;
}

export interface DistributionData {
  id: string;
  title: string;
  data: DistributionItem[];
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

export interface CategoryReportNode {
  id: string;
  name: string;
  color: string;
  amount: number;
  count: number;
  percentage: number;
  subcategories: CategoryReportNode[];
  transactions: {
    id: string;
    description: string;
    amount: number;
    date: Date;
    type: TransactionType;
    category?: { id: string; name: string; color: string; icon?: string | null } | null;
  }[];
}

export interface ReportData {
  summary: {
    totalAmount: number;
    transactionCount: number;
    averageAmount: number;
  };
  timeSeries: { date: string; amount: number }[];
  incomeTimeSeries: { date: string; amount: number }[];
  incomeVsOutcomeSeries: { date: string; income: number; outcome: number }[];
  categoryBreakdown: CategoryReportNode[];
  merchantBreakdown: {
    name: string;
    amount: number;
    count: number;
    percentage: number;
    transactionIds: string[];
    transactionType?: TransactionType | null;
    primaryCategory?: { id: string; name: string; color: string; icon?: string | null } | null;
    color: string; // Consistent color for distribution charts
  }[];
  accountDistribution: { name: string; amount: number; color: string; count: number; percentage: number }[];
  recurringVsOneTime: { name: string; amount: number; color: string; count: number; percentage: number }[];
  weekdayPattern: { name: string; amount: number; color: string; count: number; percentage: number }[];
  subcategoryData: { name: string; amount: number; color: string; count: number; percentage: number }[];
  largestTransactions: {
    id: string;
    description: string;
    amount: number;
    date: Date;
    type: TransactionType;
    category?: { id: string; name: string; color: string; icon?: string | null } | null;
    account?: { id: string; name: string } | null;
  }[];
}
