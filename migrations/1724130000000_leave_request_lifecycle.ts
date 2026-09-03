/**
 * F4 — leave request lifecycle: a cancel timestamp and an optional list of extra
 * users to notify about the request (delivery lands in F11; F4 just stores it).
 */
export async function up(pgm: any): Promise<void> {
  await pgm.sql(`
    ALTER TABLE leave_requests
      ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS notify_user_ids UUID[] NOT NULL DEFAULT '{}';
  `);
}

export async function down(pgm: any): Promise<void> {
  await pgm.sql(`
    ALTER TABLE leave_requests
      DROP COLUMN IF EXISTS cancelled_at,
      DROP COLUMN IF EXISTS notify_user_ids;
  `);
}
