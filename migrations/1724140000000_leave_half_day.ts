/**
 * F4 — half-day leave. A request applies to a whole day (`full_day`) or one
 * half of a single day (`first_half` / `second_half`). Extends `leave_requests`
 * with one column rather than a separate table; `duration_days` (NUMERIC)
 * already supports fractional values.
 */
export async function up(pgm: any): Promise<void> {
  await pgm.sql(`
    ALTER TABLE leave_requests
      ADD COLUMN IF NOT EXISTS half_day_option VARCHAR(20) NOT NULL DEFAULT 'full_day';

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'leave_requests_half_day_option_check'
      ) THEN
        ALTER TABLE leave_requests
          ADD CONSTRAINT leave_requests_half_day_option_check
          CHECK (half_day_option IN ('full_day', 'first_half', 'second_half'));
      END IF;
    END $$;
  `);
}

export async function down(pgm: any): Promise<void> {
  await pgm.sql(`
    ALTER TABLE leave_requests
      DROP CONSTRAINT IF EXISTS leave_requests_half_day_option_check,
      DROP COLUMN IF EXISTS half_day_option;
  `);
}
