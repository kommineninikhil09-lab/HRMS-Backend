/**
 * Formats a Postgres `DATE` value (which `node-pg` returns as a JS `Date` at
 * local midnight) as a calendar `YYYY-MM-DD` string. Uses local date parts, not
 * `toISOString()`, which would shift the day across the UTC boundary. Values that
 * are already date strings are passed through (date portion only).
 */
export function toIsoDate(
  value: Date | string | null | undefined,
): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

/**
 * Parse a `YYYY-MM-DD` string to a **local-midnight** `Date`. Built from the
 * numeric parts (not `new Date(str)`, which parses as UTC) so day-of-week and
 * day iteration are correct regardless of the server timezone.
 */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
