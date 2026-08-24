export async function up(pgm: any): Promise<void> {
  // Link employees to their users based on email match
  // This ensures employee records have the user_id foreign key set
  await pgm.sql(`
    UPDATE employees e
    SET user_id = u.id
    FROM users u
    WHERE e.organization_id = u.organization_id
    AND LOWER(e.work_email) = LOWER(u.email)
    AND e.user_id IS NULL;
  `);
}

export async function down(pgm: any): Promise<void> {
  // This is a data fix, not reversible
  // Intentionally left empty
}

