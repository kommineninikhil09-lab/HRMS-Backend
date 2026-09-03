/**
 * Financial-year helpers.
 *
 * The organisation operates on the Indian April–March financial year. The
 * canonical representation across the codebase (leave balances, tax, payroll)
 * is the string `"YYYY-YYYY"`, e.g. `"2026-2027"` for 1 Apr 2026 – 31 Mar 2027.
 */

/** Returns the financial year containing `date` as `"YYYY-YYYY"`. */
export function getFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  // getMonth() is 0-indexed; 3 === April.
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

/** `{ start, end }` Date bounds (inclusive start, exclusive end) for a `"YYYY-YYYY"` FY. */
export function financialYearRange(fy: string): { start: Date; end: Date } {
  const startYear = Number(fy.slice(0, 4));
  return {
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 3, 1),
  };
}
