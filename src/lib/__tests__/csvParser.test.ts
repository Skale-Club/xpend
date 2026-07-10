import { describe, it, expect } from 'vitest';
import { parseDate, parseAmount, inferDateOrder } from '@/lib/csvParser';

describe('parseDate', () => {
  it('parses ISO dates at UTC midnight', () => {
    const date = parseDate('2024-02-15');
    expect(date?.toISOString()).toBe('2024-02-15T00:00:00.000Z');
  });

  it('parses ISO datetimes ignoring the time part', () => {
    const date = parseDate('2024-02-15T13:45:00');
    expect(date?.toISOString()).toBe('2024-02-15T00:00:00.000Z');
  });

  it('parses unambiguous day-first dates regardless of order hint', () => {
    const date = parseDate('25/02/2024', 'MDY');
    expect(date?.toISOString()).toBe('2024-02-25T00:00:00.000Z');
  });

  it('parses unambiguous month-first dates regardless of order hint', () => {
    const date = parseDate('02/25/2024', 'DMY');
    expect(date?.toISOString()).toBe('2024-02-25T00:00:00.000Z');
  });

  it('resolves ambiguous dates using the file-level order', () => {
    expect(parseDate('05/02/2024', 'DMY')?.toISOString()).toBe('2024-02-05T00:00:00.000Z');
    expect(parseDate('05/02/2024', 'MDY')?.toISOString()).toBe('2024-05-02T00:00:00.000Z');
  });

  it('expands two-digit years', () => {
    expect(parseDate('25/02/24', 'DMY')?.toISOString()).toBe('2024-02-25T00:00:00.000Z');
    expect(parseDate('25/02/99', 'DMY')?.toISOString()).toBe('1999-02-25T00:00:00.000Z');
  });

  it('rejects impossible dates instead of overflowing', () => {
    expect(parseDate('31/02/2024', 'DMY')).toBeNull();
    expect(parseDate('00/05/2024', 'DMY')).toBeNull();
    expect(parseDate('15/13/2024', 'MDY')).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate('')).toBeNull();
  });
});

describe('inferDateOrder', () => {
  it('detects day-first files from any day > 12', () => {
    expect(inferDateOrder(['05/02/2024', '13/02/2024', '20/02/2024'])).toBe('DMY');
  });

  it('detects month-first files from any second component > 12', () => {
    expect(inferDateOrder(['02/05/2024', '02/13/2024'])).toBe('MDY');
  });

  it('defaults to MDY when every date is ambiguous', () => {
    expect(inferDateOrder(['05/02/2024', '01/03/2024'])).toBe('MDY');
    expect(inferDateOrder([])).toBe('MDY');
  });

  it('ignores non-numeric date strings', () => {
    expect(inferDateOrder(['2024-02-15', '25/02/2024'])).toBe('DMY');
  });
});

describe('parseAmount', () => {
  it('parses plain amounts', () => {
    expect(parseAmount('123.45')).toBe(123.45);
    expect(parseAmount('-42')).toBe(-42);
  });

  it('strips currency symbols and codes, including R$', () => {
    expect(parseAmount('$1,234.56')).toBe(1234.56);
    expect(parseAmount('R$ 1.234,56')).toBe(1234.56);
    expect(parseAmount('€99,90')).toBe(99.9);
  });

  it('handles European decimal commas', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('12,34')).toBe(12.34);
    expect(parseAmount('1,234')).toBe(1234);
  });

  it('handles negative formats', () => {
    expect(parseAmount('(123.45)')).toBe(-123.45);
    expect(parseAmount('123.45-')).toBe(-123.45);
    expect(parseAmount('- $12.50')).toBe(-12.5);
  });

  it('returns NaN for unparseable values so callers can skip the row', () => {
    expect(Number.isNaN(parseAmount('abc'))).toBe(true);
    expect(Number.isNaN(parseAmount(''))).toBe(true);
  });
});
