export interface ParsedTransaction {
    date: Date;
    description: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    categoryId?: string | null;
}

// Matches a transaction-leading date like MM/DD/YY or MM/DD/YYYY.
// Requires the full day/month/year shape so embedded MM/DD tokens inside
// descriptions (e.g. "04/02 #000320428") are not mistaken for a new row.
const TX_DATE = /(?<!\d)(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}))(?!\d)/g;

// A monetary amount: optional minus, optional $, optional thousands grouping,
// exactly two decimals. The two-decimal requirement avoids matching ID numbers.
// The trailing (?!\d) stops "1.88" from matching inside longer runs like the
// "1.888.BUSINESS" support number printed in statement headers.
const AMOUNT = /(-?)\$?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2}))(?!\d)/;

// Section headers tell us the transaction type when amounts are unsigned.
// Covers both the personal-checking wording ("additions"/"subtractions") and
// the business-checking wording ("credits"/"debits").
const SECTION_HEADER =
    /(deposits and other (?:additions|credits)|atm and debit card subtractions|other subtractions|service fees|withdrawals and other (?:subtractions|debits)|fees and other (?:withdrawals|subtractions))/gi;

interface Section {
    index: number;
    type: 'INCOME' | 'EXPENSE';
}

function buildSections(text: string): Section[] {
    const sections: Section[] = [];
    let match: RegExpExecArray | null;
    SECTION_HEADER.lastIndex = 0;
    while ((match = SECTION_HEADER.exec(text)) !== null) {
        const header = match[1].toLowerCase();
        const type: 'INCOME' | 'EXPENSE' =
            header.includes('deposit') || header.includes('addition') || header.includes('credit')
                ? 'INCOME'
                : 'EXPENSE';
        sections.push({ index: match.index, type });
    }
    return sections;
}

function sectionTypeAt(sections: Section[], index: number): 'INCOME' | 'EXPENSE' | null {
    let current: 'INCOME' | 'EXPENSE' | null = null;
    for (const section of sections) {
        if (section.index <= index) current = section.type;
        else break;
    }
    return current;
}

function parseStatementDate(value: string): Date | null {
    const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!match) return null;

    let month = parseInt(match[1], 10);
    let day = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);

    // Default to US MM/DD ordering (these statements are US-issued), but swap
    // when the first field can't be a month and the second can.
    if (month > 12 && day <= 12) {
        [month, day] = [day, month];
    }

    if (year < 100) year = year > 50 ? 1900 + year : 2000 + year;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
}

function parseAmount(sign: string, digits: string): number {
    const value = parseFloat(digits.replace(/,/g, ''));
    return isNaN(value) ? NaN : value;
}

function cleanDescription(raw: string): string {
    return raw
        .replace(/\s+continued on the next page.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Deterministically extracts transactions from already-extracted PDF statement
 * text. No AI, no network. Returns [] when nothing parseable is found so the
 * caller can fall back to an AI parser for unrecognized layouts.
 */
export function parseStatementText(text: string): ParsedTransaction[] {
    if (!text || text.trim().length === 0) return [];

    // The "Daily ledger balances" table (and trailing fee-waiver disclosures)
    // sit after all real transactions. Its Date/Balance rows and the fine print
    // can be misread as transactions, so drop everything from that point on.
    text = text.split(/Daily ledger balances/i)[0];

    const sections = buildSections(text);

    // Collect every transaction-leading date and its position.
    const anchors: { index: number; dateStr: string; afterDate: number }[] = [];
    let match: RegExpExecArray | null;
    TX_DATE.lastIndex = 0;
    while ((match = TX_DATE.exec(text)) !== null) {
        anchors.push({
            index: match.index,
            dateStr: match[1],
            afterDate: match.index + match[0].length,
        });
    }

    const transactions: ParsedTransaction[] = [];

    for (let i = 0; i < anchors.length; i++) {
        const anchor = anchors[i];
        const sliceEnd = i + 1 < anchors.length ? anchors[i + 1].index : text.length;
        const slice = text.slice(anchor.afterDate, sliceEnd);

        const amountMatch = slice.match(AMOUNT);
        if (!amountMatch || amountMatch.index === undefined) continue;

        const date = parseStatementDate(anchor.dateStr);
        if (!date) continue;

        const amount = parseAmount(amountMatch[1], amountMatch[2]);
        if (isNaN(amount) || amount === 0) continue;

        const description = cleanDescription(slice.slice(0, amountMatch.index));
        if (!description) continue;

        // Type: an explicit minus sign always means an expense. Otherwise rely
        // on the enclosing section header; default to INCOME for unsigned rows.
        let type: 'INCOME' | 'EXPENSE';
        if (amountMatch[1] === '-') {
            type = 'EXPENSE';
        } else {
            type = sectionTypeAt(sections, anchor.index) ?? 'INCOME';
        }

        transactions.push({ date, description, amount: Math.abs(amount), type });
    }

    return transactions;
}

export interface StatementReconciliation {
    reconciled: boolean; // false when totals couldn't be extracted OR they mismatch
    hasTotals: boolean; // were the summary totals found at all?
    expectedIncome: number | null;
    expectedExpense: number | null;
    actualIncome: number;
    actualExpense: number;
}

// First money token appearing after `label` (single, non-global match).
function moneyAfterLabel(text: string, label: RegExp): number | null {
    const m = label.exec(text);
    if (!m || m.index === undefined) return null;
    const rest = text.slice(m.index + m[0].length);
    const money = rest.match(AMOUNT);
    if (!money) return null;
    const value = parseFloat(money[2].replace(/,/g, ''));
    if (isNaN(value)) return null;
    return money[1] === '-' ? -value : value;
}

/**
 * Reconciles parsed checking/savings transactions against the statement's own
 * `Account summary` totals using the balance identity (robust to how many
 * subtraction sub-lines a statement prints):
 *   expectedIncome  = Deposits and other additions
 *   expectedExpense = Beginning balance + Deposits − Ending balance
 * Informational only — the caller logs the outcome but never blocks on it.
 */
export function reconcileStatementText(
    text: string,
    txs: ParsedTransaction[],
): StatementReconciliation {
    const beginning = moneyAfterLabel(text, /Beginning balance[^\n$]*\$?/i);
    const deposits = moneyAfterLabel(text, /Deposits and other additions/i);
    const ending = moneyAfterLabel(text, /Ending balance[^\n$]*\$?/i);

    let actualIncome = 0;
    let actualExpense = 0;
    for (const t of txs) {
        if (t.type === 'INCOME') actualIncome += t.amount;
        else actualExpense += t.amount;
    }

    const hasTotals = beginning !== null && deposits !== null && ending !== null;
    if (!hasTotals) {
        return {
            reconciled: false,
            hasTotals: false,
            expectedIncome: null,
            expectedExpense: null,
            actualIncome,
            actualExpense,
        };
    }

    const expectedIncome = deposits!;
    const expectedExpense = beginning! + deposits! - ending!;
    const reconciled =
        Math.abs(actualIncome - expectedIncome) < 0.01 &&
        Math.abs(actualExpense - expectedExpense) < 0.01;

    return { reconciled, hasTotals, expectedIncome, expectedExpense, actualIncome, actualExpense };
}
