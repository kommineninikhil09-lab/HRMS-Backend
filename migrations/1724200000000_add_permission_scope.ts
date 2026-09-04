// Phase 0 foundation migration for the RBAC + Scope authorization plan
// (implementation.md §6.2). Purely additive — does not change any existing
// route's behavior; ScopeGuard/ScopeService (added separately) are what
// actually start enforcing this.
//
// NOTE ON ROLE NAMES: implementation.md's original §6.2 draft assumed roles
// named 'Admin', 'Manager', 'HR Manager', 'Employee', 'Super Admin'. The real
// seed (src/database/seeds/seed.ts) only creates three: 'Admin', 'HR Manager',
// 'Employee' — there is no standalone 'Manager' or 'Super Admin' role in this
// codebase. 'HR Manager' is the role that functions as the "manager" persona
// today (it holds leave.approve/attendance.manage and the frontend normalizes
// it to the 'manager' role — see frontend src/app/api/auth/me/route.ts). This
// migration backfills against the real three roles, not the assumed five.

export async function up(pgm: any): Promise<void> {
  await pgm.sql(`
    CREATE TYPE permission_scope AS ENUM ('SELF', 'TEAM', 'ORGANIZATION');
  `);

  await pgm.sql(`
    ALTER TABLE role_permissions
      ADD COLUMN scope permission_scope NOT NULL DEFAULT 'SELF';
  `);

  // Backfill existing role_permissions with sensible per-role defaults.
  // Per-permission overrides (e.g. audit.read always ORGANIZATION even for
  // HR Manager) are layered in during each module's Phase 1 retrofit, not here.
  await pgm.sql(`
    UPDATE role_permissions rp
    SET scope = 'ORGANIZATION'
    FROM roles r
    WHERE rp.role_id = r.id AND r.name = 'Admin';
  `);

  await pgm.sql(`
    UPDATE role_permissions rp
    SET scope = 'TEAM'
    FROM roles r
    WHERE rp.role_id = r.id AND r.name = 'HR Manager';
  `);

  await pgm.sql(`
    UPDATE role_permissions rp
    SET scope = 'SELF'
    FROM roles r
    WHERE rp.role_id = r.id AND r.name = 'Employee';
  `);

  // New permissions: the employee.read vs employee.directory.read split
  // (implementation.md §2.3).
  await pgm.sql(`
    INSERT INTO permissions (code, description, module)
    VALUES ('employee.directory.read', 'Read the company directory (safe fields only: name, photo, designation, department, location)', 'Employee')
    ON CONFLICT (code) DO NOTHING;
  `);

  await pgm.sql(`
    INSERT INTO permissions (code, description, module)
    VALUES ('employee.sensitive.read', 'Read restricted fields (Aadhaar, PAN, bank details, salary, documents)', 'Employee')
    ON CONFLICT (code) DO NOTHING;
  `);

  // Grant employee.directory.read org-wide to every role — every employee
  // can see the company directory (§2.3).
  await pgm.sql(`
    INSERT INTO role_permissions (organization_id, role_id, permission_id, scope)
    SELECT r.organization_id, r.id, p.id, 'ORGANIZATION'
    FROM roles r, permissions p
    WHERE r.name IN ('Admin', 'HR Manager', 'Employee')
      AND p.code = 'employee.directory.read'
    ON CONFLICT (role_id, permission_id) DO UPDATE SET scope = EXCLUDED.scope;
  `);

  // Grant employee.sensitive.read: Admin and HR Manager org-wide (they
  // administer HR data), Employee SELF-only (an employee can see their own
  // restricted fields, e.g. their own uploaded ID documents) — matches the
  // classification table in §2.5 and the v1 user stories in §5.1.
  await pgm.sql(`
    INSERT INTO role_permissions (organization_id, role_id, permission_id, scope)
    SELECT r.organization_id, r.id, p.id, 'ORGANIZATION'
    FROM roles r, permissions p
    WHERE r.name IN ('Admin', 'HR Manager')
      AND p.code = 'employee.sensitive.read'
    ON CONFLICT (role_id, permission_id) DO UPDATE SET scope = EXCLUDED.scope;
  `);

  await pgm.sql(`
    INSERT INTO role_permissions (organization_id, role_id, permission_id, scope)
    SELECT r.organization_id, r.id, p.id, 'SELF'
    FROM roles r, permissions p
    WHERE r.name = 'Employee'
      AND p.code = 'employee.sensitive.read'
    ON CONFLICT (role_id, permission_id) DO UPDATE SET scope = EXCLUDED.scope;
  `);
}

export async function down(pgm: any): Promise<void> {
  await pgm.sql(`
    DELETE FROM role_permissions rp
    USING permissions p
    WHERE rp.permission_id = p.id
      AND p.code IN ('employee.directory.read', 'employee.sensitive.read');
  `);

  await pgm.sql(`DELETE FROM permissions WHERE code = 'employee.directory.read';`);
  await pgm.sql(`DELETE FROM permissions WHERE code = 'employee.sensitive.read';`);

  await pgm.sql(`ALTER TABLE role_permissions DROP COLUMN scope;`);
  await pgm.sql(`DROP TYPE permission_scope;`);
}
