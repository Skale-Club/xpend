interface CurrencyFormatOptions {
  hideSensitiveValues?: boolean;
  hiddenValue?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function formatCurrency(value: number, options: CurrencyFormatOptions = {}): string {
  const {
    hideSensitiveValues = false,
    hiddenValue = '••••••',
    minimumFractionDigits,
    maximumFractionDigits,
  } = options;

  if (hideSensitiveValues) {
    return hiddenValue;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

export function formatCurrencyTick(value: number, hideSensitiveValues = false): string {
  return formatCurrency(value, {
    hideSensitiveValues,
    hiddenValue: '••••',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatMonthYear(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function getMonthName(month: number): string {
  const date = new Date(2024, month - 1, 1);
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
}

export function generateMonths(year: number): { month: number; year: number; label: string }[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    year,
    label: getMonthName(i + 1),
  }));
}

export function generateTimelineYears(startYear: number, endYear: number): number[] {
  const years: number[] = [];
  for (let year = startYear; year <= endYear; year++) {
    years.push(year);
  }
  return years;
}

export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}
