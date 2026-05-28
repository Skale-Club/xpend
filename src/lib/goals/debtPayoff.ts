import type { Goal, GoalCalculation } from './types';

// Safety cap so a payment that never covers interest can't loop forever.
const MONTHS_CAP = 1200;
const DAYS_PER_MONTH = 365.25 / 12;

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  const whole = Math.floor(months);
  const fracDays = Math.round((months - whole) * DAYS_PER_MONTH);
  d.setMonth(d.getMonth() + whole);
  d.setDate(d.getDate() + fracDays);
  return d;
}

function monthlyRate(annualRatePercent: number): number {
  return (Number(annualRatePercent) || 0) / 100 / 12;
}

export interface PayoffResult {
  months: number | null; // null when the payment never clears the balance
  totalInterest: number;
  totalPaid: number;
  payoffDate: string | null;
}

/**
 * Simulate paying off a balance with a fixed monthly payment, accruing
 * interest monthly. Returns null months when the payment can't cover the
 * monthly interest (the debt would never be repaid).
 */
export function simulatePayoff(
  balance: number,
  annualRatePercent: number,
  monthlyPayment: number,
  now: Date = new Date(),
): PayoffResult {
  let bal = Math.max(0, balance);
  const mr = monthlyRate(annualRatePercent);
  const payment = Math.max(0, monthlyPayment);

  if (bal === 0) {
    return { months: 0, totalInterest: 0, totalPaid: 0, payoffDate: now.toISOString() };
  }

  // Payment can't cover the first month's interest → never pays off.
  if (payment <= bal * mr) {
    return { months: null, totalInterest: Infinity, totalPaid: Infinity, payoffDate: null };
  }

  let months = 0;
  let totalInterest = 0;
  let totalPaid = 0;

  while (bal > 0 && months < MONTHS_CAP) {
    const interest = bal * mr;
    bal += interest;
    totalInterest += interest;
    const pay = Math.min(payment, bal);
    bal -= pay;
    totalPaid += pay;
    months += 1;
    if (bal < 0.005) bal = 0;
  }

  if (months >= MONTHS_CAP && bal > 0) {
    return { months: null, totalInterest: Infinity, totalPaid: Infinity, payoffDate: null };
  }

  return {
    months,
    totalInterest,
    totalPaid,
    payoffDate: addMonths(now, months).toISOString(),
  };
}

/**
 * The fixed monthly payment required to clear a balance in exactly `months`
 * months at the given annual rate (standard amortization formula).
 */
export function requiredPaymentForMonths(
  balance: number,
  annualRatePercent: number,
  months: number,
): number {
  const bal = Math.max(0, balance);
  if (months <= 0) return bal;
  const mr = monthlyRate(annualRatePercent);
  if (mr === 0) return bal / months;
  return (bal * mr) / (1 - Math.pow(1 + mr, -months));
}

export interface DebtPayoffSummary {
  balance: number;
  annualRate: number;
  minimumPayment: number | null;
  // Scenario: paying only the minimum payment.
  minimumScenario: PayoffResult | null;
  // Payment required to hit the goal's target date (if any).
  requiredForTargetDate: number | null;
  monthsToTarget: number | null;
}

/**
 * Build a debt-payoff summary for a single debt goal: the minimum-payment
 * scenario (with total interest) and the payment required to meet the target
 * date. Pure — derives everything from the goal + its progress calc.
 */
export function debtPayoffSummary(goal: Goal, calc: GoalCalculation): DebtPayoffSummary {
  const balance = calc.amountRemaining;
  const annualRate = Number(goal.interestRate) || 0;
  const minimumPayment = goal.minimumPayment != null ? Number(goal.minimumPayment) : null;

  const minimumScenario =
    minimumPayment != null && minimumPayment > 0
      ? simulatePayoff(balance, annualRate, minimumPayment)
      : null;

  let requiredForTargetDate: number | null = null;
  let monthsToTarget: number | null = null;
  if (calc.monthsRemaining != null && calc.monthsRemaining > 0) {
    monthsToTarget = Math.ceil(calc.monthsRemaining);
    requiredForTargetDate = requiredPaymentForMonths(balance, annualRate, monthsToTarget);
  }

  return {
    balance,
    annualRate,
    minimumPayment,
    minimumScenario,
    requiredForTargetDate,
    monthsToTarget,
  };
}

// ---- Multi-debt strategies: snowball & avalanche ----

export interface DebtInput {
  id: string;
  name: string;
  balance: number;
  annualRate: number;
  minimumPayment: number;
}

export interface DebtStrategyResult {
  strategy: 'snowball' | 'avalanche';
  paidOff: boolean;
  totalMonths: number | null;
  totalInterest: number;
  totalPaid: number;
  order: { id: string; name: string; payoffMonth: number | null }[];
}

/**
 * Simulate the debt snowball (smallest balance first) or avalanche (highest
 * interest rate first) strategy across multiple debts, month by month. The
 * total monthly budget is the sum of all minimum payments plus `extraMonthly`;
 * leftover money (including freed-up minimums from cleared debts) is poured
 * into the highest-priority remaining debt.
 */
export function buildDebtStrategy(
  debts: DebtInput[],
  extraMonthly: number,
  strategy: 'snowball' | 'avalanche',
): DebtStrategyResult {
  const state = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({
      ...d,
      balance: d.balance,
      payoffMonth: null as number | null,
    }));

  const budget = state.reduce((sum, d) => sum + Math.max(0, d.minimumPayment), 0) + Math.max(0, extraMonthly);

  const priority = (a: typeof state[number], b: typeof state[number]) =>
    strategy === 'snowball' ? a.balance - b.balance : b.annualRate - a.annualRate;

  let month = 0;
  let totalInterest = 0;
  let totalPaid = 0;

  const active = () => state.filter((d) => d.balance > 0);

  // Guard: if the budget can't cover combined first-month interest, it's unpayable.
  const firstMonthInterest = state.reduce((sum, d) => sum + d.balance * monthlyRate(d.annualRate), 0);
  if (budget <= firstMonthInterest && state.length > 0) {
    return {
      strategy,
      paidOff: false,
      totalMonths: null,
      totalInterest: Infinity,
      totalPaid: Infinity,
      order: state.map((d) => ({ id: d.id, name: d.name, payoffMonth: null })),
    };
  }

  while (active().length > 0 && month < MONTHS_CAP) {
    month += 1;

    // Accrue interest.
    const payments = new Map<string, number>();
    for (const d of active()) {
      const interest = d.balance * monthlyRate(d.annualRate);
      d.balance += interest;
      totalInterest += interest;
      payments.set(d.id, 0);
    }

    // Pay minimums first (capped at the outstanding balance).
    let available = budget;
    for (const d of active()) {
      const pay = Math.min(d.minimumPayment, d.balance);
      payments.set(d.id, pay);
      available -= pay;
    }

    // Pour leftover into priority order.
    const ordered = active().slice().sort(priority);
    for (const d of ordered) {
      if (available <= 0) break;
      const alreadyPaying = payments.get(d.id) ?? 0;
      const owed = d.balance - alreadyPaying;
      const add = Math.min(available, Math.max(0, owed));
      payments.set(d.id, alreadyPaying + add);
      available -= add;
    }

    // Apply payments.
    for (const d of active()) {
      const pay = payments.get(d.id) ?? 0;
      d.balance -= pay;
      totalPaid += pay;
      if (d.balance < 0.005) {
        d.balance = 0;
        d.payoffMonth = month;
      }
    }
  }

  const paidOff = state.every((d) => d.balance === 0);

  return {
    strategy,
    paidOff,
    totalMonths: paidOff ? month : null,
    totalInterest,
    totalPaid,
    order: state
      .slice()
      .sort((a, b) => (a.payoffMonth ?? Infinity) - (b.payoffMonth ?? Infinity))
      .map((d) => ({ id: d.id, name: d.name, payoffMonth: d.payoffMonth })),
  };
}
