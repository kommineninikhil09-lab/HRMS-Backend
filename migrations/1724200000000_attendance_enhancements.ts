/**
 * F3 — Attendance Management.
 *
 * The `attendance` table already exists (foundation migration
 * `1723503410000_create_attendance_tables`). This migration extends it with the
 * fields the check-in / check-out flow and the monthly summary need:
 *
 *  - `working_minutes`      — filled on check-out from (check_out − check_in).
 *  - `late_minutes`         — reserved. Stays NULL until a per-employee / per-org
 *                             work-schedule configuration exists (there is none
 *                             yet). No universal start time is assumed.
 *  - `early_leave_minutes`  — reserved, same dependency as `late_minutes`.
 *  - `source`               — how the row was created: 'web' (employee self
 *                             check-in) or 'admin' (HR marked it).
 *
 * It also adds a composite `(organization_id, attendance_date)` index for the
 * admin "attendance on a date" list, and a CHECK constraint pinning the stored
 * status vocabulary. Derived states (weekend / holiday / absent) are computed at
 * read time and never stored.
 *
 * All statements are idempotent so the migration is safe to re-run.
 */
export async function up(pgm: any): Promise<void> {
  await pgm.sql(`
    ALTER TABLE attendance
      ADD COLUMN IF NOT EXISTS working_minutes    INTEGER,
      ADD COLUMN IF NOT EXISTS late_minutes       INTEGER,
      ADD COLUMN IF NOT EXISTS early_leave_minutes INTEGER,
      ADD COLUMN IF NOT EXISTS source             VARCHAR(20) NOT NULL DEFAULT 'web';
  `);

  // Normalise any legacy hyphenated statuses to the underscore vocabulary used
  // across the codebase (matches leave's `half_day_option`).
  await pgm.sql(`
    UPDATE attendance SET status = 'half_day'        WHERE status = 'half-day';
    UPDATE attendance SET status = 'work_from_home'  WHERE status = 'work-from-home';
    UPDATE attendance SET status = 'on_leave'        WHERE status = 'on-leave';
  `);

  await pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'attendance_status_check'
      ) THEN
        ALTER TABLE attendance
          ADD CONSTRAINT attendance_status_check
          CHECK (status IN ('present', 'absent', 'half_day', 'on_leave', 'work_from_home'));
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'attendance_source_check'
      ) THEN
        ALTER TABLE attendance
          ADD CONSTRAINT attendance_source_check
          CHECK (source IN ('web', 'admin'));
      END IF;
    END $$;
  `);

  await pgm.sql(`
    CREATE INDEX IF NOT EXISTS attendance_org_date_index
      ON attendance (organization_id, attendance_date);
  `);
}

export async function down(pgm: any): Promise<void> {
  await pgm.sql(`
    DROP INDEX IF EXISTS attendance_org_date_index;

    ALTER TABLE attendance
      DROP CONSTRAINT IF EXISTS attendance_status_check,
      DROP CONSTRAINT IF EXISTS attendance_source_check;

    ALTER TABLE attendance
      DROP COLUMN IF EXISTS working_minutes,
      DROP COLUMN IF EXISTS late_minutes,
      DROP COLUMN IF EXISTS early_leave_minutes,
      DROP COLUMN IF EXISTS source;
  `);
}
