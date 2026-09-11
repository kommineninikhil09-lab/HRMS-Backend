/**
 * Adds two permission codes that split employee-read into safe-directory vs.
 * restricted-fields access: `employee.directory.read` (name/photo/designation/
 * department/location — safe for anyone in the org to see) and
 * `employee.sensitive.read` (government ID numbers, bank details, salary,
 * uploaded documents — must never be bundled into directory access).
 *
 * Idempotent (`WHERE NOT EXISTS`): as of this migration being written, both
 * rows already exist in the shared dev database with no migration tracking
 * them — untracked drift, same pattern as the `permission_scope` column
 * removed in 1724220000000. This migration is written for environments that
 * don't have that drift (a fresh install), and is a safe no-op where it's
 * already present. It intentionally does NOT touch role_permissions grants —
 * see 1724240000000_grant_directory_and_sensitive_permissions for that, which
 * also corrects an over-grant already present on this database (Employee role
 * currently holds employee.sensitive.read, which it should not).
 */

export async function up(pgm: any): Promise<void> {
  await pgm.sql(`
    INSERT INTO permissions (code, description, module)
    SELECT 'employee.directory.read',
           'Read the company directory (safe fields only: name, photo, designation, department, location)',
           'employee'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'employee.directory.read');
  `);

  await pgm.sql(`
    INSERT INTO permissions (code, description, module)
    SELECT 'employee.sensitive.read',
           'Read restricted employee fields (government ID numbers, bank details, salary, uploaded documents)',
           'employee'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'employee.sensitive.read');
  `);
}

export async function down(pgm: any): Promise<void> {
  await pgm.sql(`
    DELETE FROM permissions WHERE code IN ('employee.directory.read', 'employee.sensitive.read');
  `);
}
