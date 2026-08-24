export async function up(pgm: any): Promise<void> {
  await pgm.sql(`
    ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS marked_by uuid REFERENCES users(id);
  `);
}

export async function down(pgm: any): Promise<void> {
  await pgm.sql(`
    ALTER TABLE attendance
    DROP COLUMN IF EXISTS marked_by;
  `);
}

