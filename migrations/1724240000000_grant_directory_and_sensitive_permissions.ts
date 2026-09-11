/**
 * Grants employee.directory.read / employee.sensitive.read (added in
 * 1724230000000) to the correct roles, and revokes an incorrect grant found
 * already live on this database.
 *
 * Confirmed live before writing this migration:
 *   - Real roles: Employee, Admin, Super Admin (no Manager, no HR Manager —
 *     HR Manager was merged into Super Admin).
 *   - Both new permission codes were already granted to all three roles,
 *     including Employee holding employee.sensitive.read — drift from the
 *     same abandoned design that left the permission_scope column behind
 *     (dropped in 1724220000000). No endpoint currently reads
 *     employee.sensitive.read (it doesn't exist until P1-03), so this
 *     hasn't caused any data exposure — but it would the moment that
 *     endpoint ships, so it's corrected here rather than left for later.
 *
 * Target state:
 *   - employee.directory.read  -> Employee, Admin, Super Admin (org-wide
 *     directory, safe fields only, meant to be visible to everyone).
 *   - employee.sensitive.read  -> Admin, Super Admin only. Employee is
 *     explicitly revoked, not just "not granted" — the row already existed.
 *
 * Holding employee.sensitive.read is necessary but not sufficient to read a
 * given employee's restricted fields: TenantContext.scope (manager_scopes /
 * scope.all, resolved per-request by JwtAuthGuard) still gates which
 * specific employee IDs a caller can reach through the endpoint that will
 * check this permission (P1-03). This migration only decides who can hold
 * the permission at all.
 */

export async function up(pgm: any): Promise<void> {
  await pgm.sql(`
    INSERT INTO role_permissions (organization_id, role_id, permission_id)
    SELECT r.organization_id, r.id, p.id
    FROM roles r, permissions p
    WHERE r.name IN ('Employee', 'Admin', 'Super Admin') AND p.code = 'employee.directory.read'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  `);

  await pgm.sql(`
    INSERT INTO role_permissions (organization_id, role_id, permission_id)
    SELECT r.organization_id, r.id, p.id
    FROM roles r, permissions p
    WHERE r.name IN ('Admin', 'Super Admin') AND p.code = 'employee.sensitive.read'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  `);

  await pgm.sql(`
    DELETE FROM role_permissions
    WHERE permission_id = (SELECT id FROM permissions WHERE code = 'employee.sensitive.read')
      AND role_id = (SELECT id FROM roles WHERE name = 'Employee');
  `);
}

export async function down(pgm: any): Promise<void> {
  // Reverts to "nobody holds either permission" rather than restoring the
  // pre-migration over-grant — the over-grant was a bug, not a state worth
  // reintroducing on rollback.
  await pgm.sql(`
    DELETE FROM role_permissions
    WHERE permission_id IN (
      SELECT id FROM permissions WHERE code IN ('employee.directory.read', 'employee.sensitive.read')
    );
  `);
}
