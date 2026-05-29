import type { ParsedTransaction } from '../pdfTextParser';
import type { FaturaMeta } from '../pdfParser'; // type-only — avoids a runtime import cycle

export interface FaturaTextResult {
    transactions: ParsedTransaction[];
    faturaMeta: FaturaMeta;
    // True only when both income and expense sums match the statement's own
    // printed summary totals. The caller keeps a local parse ONLY when reconciled.
    reconciled: boolean;
}

type Layout = 'boa' | 'chase';

// A monetary amount: optional minus, optional $, optional thousands grouping,
// exactly two decimals. The two-decimal requirement avoids matching ID/account
// numbers; trailing (?!\d) stops a match inside a longer digit run.
const MONEY = /(-?)\$?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2}))(?!\d)/;

// A US date token MM/DD/YY or MM/DD/YYYY.
const DATE = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;

const RECONCILE_TOLERANCE = 0.01;

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function moneyValue(sign: string, digits: string): number {
    const n = parseFloat(digits.replace(/,/g, ''));
    return sign === '-' ? -n : n;
}

// First money token appearing after `label` anywhere in the text.
function moneyAfter(text: string, label: string | RegExp): number | null {
    const labelRe = typeof label === 'string' ? new RegExp(escapeRegExp(label), 'i') : label;
    const m = labelRe.exec(text);
    if (!m || m.index === undefined) return null;
    const rest = text.slice(m.index + m[0].length);
    const money = rest.match(MONEY);
    if (!money) return null;
    return moneyValue(money[1], money[2]);
}

// First date token appearing after `label`.
function dateAfter(text: string, label: string): Date | null {
    const re = new RegExp(escapeRegExp(label), 'i');
    const m = re.exec(text);
    if (!m || m.index === undefined) return null;
    const rest = text.slice(m.index + m[0].length);
    const d = rest.match(DATE);
    if (!d) return null;
    return toDate(d[1], d[2], d[3]);
}

function toDate(mm: string, dd: string, yy: string): Date | null {
    const month = parseInt(mm, 10);
    const day = parseInt(dd, 10);
    let year = parseInt(yy, 10);
    if (year < 100) year = year > 50 ? 1900 + year : 2000 + year;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
}

// Resolve a transaction's full date from its MM/DD and the statement cycle.
// A month later than the closing month belongs to the previous calendar year
// (the cycle crosses Dec→Jan).
function dateInCycle(month: number, day: number, closing: Date): Date | null {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const closingMonth = closing.getMonth() + 1;
    const year = month > closingMonth ? closing.getFullYear() - 1 : closing.getFullYear();
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
}

function detectLayout(text: string): Layout | null {
    if (!text || text.trim().length === 0) return null;
    const isBoa =
        /Statement Closing Date/i.test(text) &&
        (/Total Credit Line/i.test(text) || /Transaction Date Posting Date Description/i.test(text));
    const isChase =
        /Opening\/Closing Date/i.test(text) &&
        (/Credit Access Line/i.test(text) || /Date of Transaction Merchant Name/i.test(text));
    // Neither or both (ambiguous) → defer to AI.
    if (isBoa === isChase) return null;
    return isBoa ? 'boa' : 'chase';
}

interface ParsedSection {
    transactions: ParsedTransaction[];
    summary: FaturaMeta;
    expectedIncome: number | null;
    expectedExpense: number | null;
}

// Slice the transaction block out of the merged text. Returns '' if the start
// marker is absent.
function sliceBlock(text: string, startRe: RegExp, endMarkers: RegExp[]): string {
    const start = startRe.exec(text);
    if (!start || start.index === undefined) return '';
    const from = start.index + start[0].length;
    let to = text.length;
    for (const endRe of endMarkers) {
        const m = endRe.exec(text.slice(from));
        if (m && from + m.index < to) to = from + m.index;
    }
    return text.slice(from, to);
}

// Build transactions from a block by anchoring on date matches; the amount is
// the FIRST money token in each row's slice (the last one would grab a section
// subtotal that the merged text sweeps into the final row).
function buildTransactions(
    block: string,
    dateAnchor: RegExp,
    dateFromMatch: (m: RegExpExecArray) => Date | null,
): ParsedTransaction[] {
    const anchors: { index: number; afterDate: number; date: Date }[] = [];
    let m: RegExpExecArray | null;
    dateAnchor.lastIndex = 0;
    while ((m = dateAnchor.exec(block)) !== null) {
        const date = dateFromMatch(m);
        if (date) anchors.push({ index: m.index, afterDate: m.index + m[0].length, date });
    }

    const transactions: ParsedTransaction[] = [];
    for (let i = 0; i < anchors.length; i++) {
        const anchor = anchors[i];
        const sliceEnd = i + 1 < anchors.length ? anchors[i + 1].index : block.length;
        const slice = block.slice(anchor.afterDate, sliceEnd);
        const money = slice.match(MONEY);
        if (!money) continue;
        const value = moneyValue(money[1], money[2]);
        if (value === 0) continue;
        const description = slice
            .slice(0, money.index)
            .replace(/\s+/g, ' ')
            .trim();
        if (!description) continue;
        // A leading minus on a card line is a credit (payment/refund) → INCOME.
        const type: 'INCOME' | 'EXPENSE' = money[1] === '-' ? 'INCOME' : 'EXPENSE';
        transactions.push({ date: anchor.date, description, amount: Math.abs(value), type });
    }
    return transactions;
}

function parseBoa(text: string): ParsedSection {
    const closing = dateAfter(text, 'Statement Closing Date');
    const block = sliceBlock(
        text,
        /Transaction Date Posting Date Description/i,
        [/Totals Year-to-Date/i, /Interest Charge Calculation/i],
    );

    const transactions = closing
        ? buildTransactions(
              block,
              // dual date: tx date then posting date; group 1/2 = tx month/day
              /(\d{2})\/(\d{2})\s+(\d{2})\/(\d{2})\s/g,
              (m) => dateInCycle(parseInt(m[1], 10), parseInt(m[2], 10), closing),
          )
        : [];

    // Scope money-bucket lookups to the contiguous account-summary block. Labels
    // like "Bank Cash Advances" also appear in the legal disclosures further down,
    // where a naive first-money match grabs an unrelated figure.
    const sumStart = text.search(/Previous Balance/i);
    const summaryText = sumStart >= 0 ? text.slice(sumStart, sumStart + 400) : '';

    const lastFourMatch = text.match(/Account#\s*[.\s\d]*?(\d{4})\b/);
    const payments = moneyAfter(summaryText, 'Payments and Other Credits');
    const purchases = moneyAfter(summaryText, 'Purchases and Adjustments');
    const cashAdvances = moneyAfter(summaryText, 'Bank Cash Advances'); // optional
    const fees = moneyAfter(summaryText, 'Fees Charged');
    const interest = moneyAfter(summaryText, 'Interest Charged');

    const summary: FaturaMeta = {
        creditLimit: moneyAfter(summaryText, 'Total Credit Line'),
        availableLimit: moneyAfter(summaryText, 'Total Credit Available'),
        closingDate: closing,
        dueDate: dateAfter(text, 'Payment Due Date'),
        totalAmount: moneyAfter(summaryText, 'New Balance Total'),
        minimumPayment: moneyAfter(text, 'Total Minimum Payment Due'),
        previousBalance: moneyAfter(summaryText, 'Previous Balance'),
        paymentsReceived: payments === null ? null : Math.abs(payments),
        lastFour: lastFourMatch ? lastFourMatch[1] : null,
        brand: 'Visa Signature',
    };

    const expectedIncome = payments === null ? null : Math.abs(payments);
    const expectedExpense =
        purchases === null || fees === null || interest === null
            ? null
            : purchases + (cashAdvances ?? 0) + fees + interest;

    return { transactions, summary, expectedIncome, expectedExpense };
}

function parseChase(text: string): ParsedSection {
    // Closing date is the 2nd date of "Opening/Closing Date MM/DD/YY - MM/DD/YY".
    const cycle = text.match(
        /Opening\/Closing Date\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i,
    );
    const closing = cycle ? toDate(cycle[1], cycle[2], cycle[3]) : null;

    // Block from the FIRST activity header to the fees/interest totals. NEVER
    // terminate at "Page N of" — that footer can precede a continuation block.
    const block = sliceBlock(
        text,
        /Date of Transaction Merchant Name/i,
        [/Total fees charged in/i, /Total interest charged in/i],
    );

    const transactions = closing
        ? buildTransactions(
              block,
              /(\d{2})\/(\d{2})(?!\/?\d)\s/g,
              (m) => dateInCycle(parseInt(m[1], 10), parseInt(m[2], 10), closing),
          )
        : [];

    // Credit limit must anchor on the trailing "Available Credit" — a payment
    // coupon prints "Credit Access Line $0.00" that wins a naive first match.
    const creditLimitMatch = text.match(/Credit Access Line\s+\$?([\d,]+(?:\.\d{2})?)\s+Available Credit/i);
    const availableMatch = text.match(/Available Credit\s+\$?([\d,]+(?:\.\d{2})?)\s+Cash Access Line/i);

    // Scope money buckets to the contiguous account-summary block — "Purchases"
    // and "Cash Advances" also appear as transaction-section headers/labels where
    // a naive first-money match grabs the wrong figure.
    const sumStart = text.search(/Previous Balance/i);
    const summaryText = sumStart >= 0 ? text.slice(sumStart, sumStart + 300) : '';

    const payments = moneyAfter(summaryText, 'Payment, Credits');
    const purchases = moneyAfter(summaryText, 'Purchases');
    const cashAdvances = moneyAfter(summaryText, 'Cash Advances'); // optional
    const balanceTransfers = moneyAfter(summaryText, 'Balance Transfers'); // optional
    const fees = moneyAfter(summaryText, 'Fees Charged');
    const interest = moneyAfter(summaryText, 'Interest Charged');

    const summary: FaturaMeta = {
        creditLimit: creditLimitMatch ? parseFloat(creditLimitMatch[1].replace(/,/g, '')) : null,
        availableLimit: availableMatch ? parseFloat(availableMatch[1].replace(/,/g, '')) : null,
        closingDate: closing,
        dueDate: dateAfter(text, 'Payment Due Date'),
        totalAmount: moneyAfter(text, 'New Balance'),
        minimumPayment: moneyAfter(text, 'Minimum Payment Due'),
        previousBalance: moneyAfter(summaryText, 'Previous Balance'),
        paymentsReceived: payments === null ? null : Math.abs(payments),
        lastFour: null,
        brand: 'Visa',
    };

    const expectedIncome = payments === null ? null : Math.abs(payments);
    const expectedExpense =
        purchases === null || fees === null || interest === null
            ? null
            : purchases + (cashAdvances ?? 0) + (balanceTransfers ?? 0) + fees + interest;

    return { transactions, summary, expectedIncome, expectedExpense };
}

function reconcile(
    transactions: ParsedTransaction[],
    expectedIncome: number | null,
    expectedExpense: number | null,
): boolean {
    if (expectedIncome === null || expectedExpense === null) return false;
    let actualIncome = 0;
    let actualExpense = 0;
    for (const t of transactions) {
        if (t.type === 'INCOME') actualIncome += t.amount;
        else actualExpense += t.amount;
    }
    return (
        Math.abs(actualIncome - expectedIncome) < RECONCILE_TOLERANCE &&
        Math.abs(actualExpense - expectedExpense) < RECONCILE_TOLERANCE
    );
}

/**
 * Deterministically parses US credit-card statements (Bank of America Visa
 * Signature, Chase). No AI, no network. Returns null when the layout is
 * unrecognized/ambiguous or the cycle can't be anchored, so the caller defers
 * to the AI fatura parser. `reconciled` is true only when the parsed sums match
 * the statement's own printed summary totals.
 */
export function parseFaturaText(text: string): FaturaTextResult | null {
    const layout = detectLayout(text);
    if (!layout) return null;

    const section = layout === 'boa' ? parseBoa(text) : parseChase(text);

    // No anchorable cycle (null closing) or no rows → don't emit mis-dated /
    // empty data; defer to AI.
    if (section.transactions.length === 0 || section.summary.closingDate === null) {
        return null;
    }

    const reconciled = reconcile(section.transactions, section.expectedIncome, section.expectedExpense);

    return { transactions: section.transactions, faturaMeta: section.summary, reconciled };
}
