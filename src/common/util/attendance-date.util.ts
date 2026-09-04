import { toIsoDate } from './date.util';

/**
 * The "attendance day" is the calendar date in the **organisation's** timezone,
 * not the server's and not UTC. A 23:30 check-in in Asia/Kolkata must land on
 * that local date even if the server clock has already rolled over in UTC.
 *
 * `organizations.timezone` holds an IANA name (e.g. "Asia/Kolkata", "UTC").
 * `Intl.DateTimeFormat` with `en-CA` yields an ISO-ordered `YYYY-MM-DD` string.
 * An unknown/empty zone falls back to the server's local date.
 */
export function attendanceDateFor(
  timezone: string | null | undefined,
  at: Date = new Date(),
): string {
  if (timezone) {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(at);
    } catch {
      // Invalid IANA name — fall through to server-local.
    }
  }
  return toIsoDate(at)!;
}

/** Inclusive first/last calendar day of a `YYYY-MM` month as ISO date strings. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  return { from: toIsoDate(first)!, to: toIsoDate(last)! };
}
