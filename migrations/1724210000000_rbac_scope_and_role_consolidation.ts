/**
 * RBAC consolidation: 4 roles -> 3 (Employee, Admin, Super Admin) + explicit
 * management scope.
 *
 *  - New permission codes: `scope.all` (organization-wide management scope) and
 *    `role.assign` (assign a role to a user). Both granted to Super Admin.
 *  - `HR Manager` is merged into `Super Admin`: every HR Manager user is moved
 *    onto Super Admin, then the HR Manager role is dropped.
 *  - `Admin` is trimmed to a team-lead permission set; the organization-wide
 *    codes it used to hold are revoked (Super Admin keeps them).
 *  - Multi-role users are de-duplicated per (organization_id, user_id) keeping
 *    the highest-privilege role, and a UNIQUE(organization_id, user_id) index
 *    enforces one primary role per user from here on.
 *  - `manager_scopes` records which teams / departments an Admin manages.
 *
 * Runtime authorization never checks role *names* — it checks permission codes
 * and the resolved scope. Role names are only used here (data migration) and in
 * seed.ts.
 *
 * Reversibility: the pre-migration `user_roles` and `role_permissions` state is
 * snapshotted into two backup tables so `down()` can restore the exact prior
 * role relationships. If those tables are absent, `down()` degrades to a
 * schema-only rollback (documented inline).
 *
 * All statements are idempotent; the migration is safe to re-run.
 */

const ADDED_PERMISSIONS: Array<[code: string, description: string, module: string]> =
  [
    ['scope.all', 'Organization-wide management scope (act on any employee)', 'scope'],
    ['role.assign', 'Assign a role to a user', 'role'],
  ];

/** Permission codes the trimmed Admin role must NOT hold (organization-wide). */
const ADMIN_REVOKE_CODES = [
  'user.read', 'user.create', 'user.update', 'user.delete',
  'role.create', 'role.update', 'role.delete', 'role.assign', 'role.read',
  'permission.read',
  'salary.read', 'salary.update',
  'employee.create', 'employee.update', 'employee.delete',
  'organization.update',
  'holiday.write',
  'organization_structure.write',
  'audit.read',
  'scope.all',
];

/** Permission codes the trimmed Admin role SHOULD hold (team-lead set). */
const ADMIN_KEEP_CODES = [
  'employee.read',
  'attendance.read', 'attendance.write', 'attendance.manage',
  'leave.read', 'leave.write', 'leave.approve',
  'ess.read', 'ess.update',
  'organization.read', 'organization_structure.read',
  'holiday.read',
];

const UR_BACKUP = '_rbac_1724210000000_user_roles_backup';
const RP_BACKUP = '_rbac_1724210000000_role_permissions_backup';

export async function up(pgm: any): Promise<void> {
  // ---------------------------------------------------------------------------
  // 0. Snapshot the current role graph for a faithful down().
  // ---------------------------------------------------------------------------
  await pgm.sql(`
    CREATE TABLE IF NOT EXISTS ${UR_BACKUP} (
      id uuid, organization_id uuid, user_id uuid, role_id uuid,
      role_name text, assigned_at timestamptz, assigned_by uuid
    );
    CREATE TABLE IF NOT EXISTS ${RP_BACKUP} (
      organization_id uuid, role_name text, permission_code text
    );
  `);
  await pgm.sql(`
    INSERT INTO ${UR_BACKUP} (id, organization_id, user_id, role_id, role_name, assigned_at, assigned_by)
    SELECT ur.id, ur.organization_id, ur.user_id, ur.role_id, r.name, ur.assigned_at, ur.assigned_by
    FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE NOT EXISTS (SELECT 1 FROM ${UR_BACKUP});
  `);
  await pgm.sql(`
    INSERT INTO ${RP_BACKUP} (organization_id, role_name, permission_code)
    SELECT rp.organization_id, r.name, p.code
    FROM role_permissions rp
    JOIN roles r ON r.id = rp.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE NOT EXISTS (SELECT 1 FROM ${RP_BACKUP});
  `);

  // ---------------------------------------------------------------------------
  // 1. New permission codes.
  // ---------------------------------------------------------------------------
  for (const [code, description, module] of ADDED_PERMISSIONS) {
    await pgm.sql(`
      INSERT INTO permissions (code, description, module)
      VALUES ('${code}', '${description}', '${module}')
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  // 2. Grant scope.all + role.assign to every Super Admin role.
  await pgm.sql(`
    INSERT INTO role_permissions (organization_id, role_id, permission_id)
    SELECT r.organization_id, r.id, p.id
    FROM roles r
    JOIN permissions p ON p.code IN ('scope.all', 'role.assign')
    WHERE r.name = 'Super Admin'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  `);

  // ---------------------------------------------------------------------------
  // 3. Merge HR Manager -> Super Admin.
  // ---------------------------------------------------------------------------
  // 3a. Make sure a Super Admin role exists for every org that has HR Manager.
  await pgm.sql(`
    INSERT INTO roles (organization_id, name, description, is_system)
    SELECT DISTINCT hm.organization_id, 'Super Admin',
           'Organization-wide HR administrator', TRUE
    FROM roles hm
    WHERE hm.name = 'HR Manager'
    ON CONFLICT (organization_id, name) DO NOTHING;
  `);
  // 3a-bis. Super Admin must hold scope.all / role.assign even where it was just created.
  await pgm.sql(`
    INSERT INTO role_permissions (organization_id, role_id, permission_id)
    SELECT r.organization_id, r.id, p.id
    FROM roles r
    JOIN permissions p ON p.code IN ('scope.all', 'role.assign')
    WHERE r.name = 'Super Admin'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  `);
  // 3b. Move HR Manager users onto Super Admin (before dropping the role).
  await pgm.sql(`
    INSERT INTO user_roles (organization_id, user_id, role_id, assigned_at, assigned_by)
    SELECT ur.organization_id, ur.user_id, sa.id, now(), ur.assigned_by
    FROM user_roles ur
    JOIN roles hm ON hm.id = ur.role_id AND hm.name = 'HR Manager'
    JOIN roles sa ON sa.organization_id = hm.organization_id AND sa.name = 'Super Admin'
    ON CONFLICT (user_id, role_id) DO NOTHING;
  `);
  // 3c. Drop HR Manager (cascades its user_roles + role_permissions).
  await pgm.sql(`DELETE FROM roles WHERE name = 'HR Manager';`);

  // ---------------------------------------------------------------------------
  // 4. Trim the Admin role to the team-lead permission set.
  // ---------------------------------------------------------------------------
  await pgm.sql(`
    DELETE FROM role_permissions rp
    USING roles r, permissions p
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
      AND r.name = 'Admin'
      AND p.code IN (${ADMIN_REVOKE_CODES.map((c) => `'${c}'`).join(', ')});
  `);
  await pgm.sql(`
    INSERT INTO role_permissions (organization_id, role_id, permission_id)
    SELECT r.organization_id, r.id, p.id
    FROM roles r
    JOIN permissions p ON p.code IN (${ADMIN_KEEP_CODES.map((c) => `'${c}'`).join(', ')})
    WHERE r.name = 'Admin'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  `);

  // ---------------------------------------------------------------------------
  // 5. One primary role per (organization_id, user_id).
  // ---------------------------------------------------------------------------
  // De-dupe first (keep highest privilege), then enforce with a unique index.
  await pgm.sql(`
    DELETE FROM user_roles ur
    USING (
      SELECT x.organization_id, x.user_id,
             (ARRAY_AGG(x.role_id ORDER BY
                CASE r.name
                  WHEN 'Super Admin' THEN 1
                  WHEN 'Admin'       THEN 2
                  WHEN 'Employee'    THEN 3
                  ELSE 4
                END, x.assigned_at))[1] AS keep_role_id
      FROM user_roles x
      JOIN roles r ON r.id = x.role_id
      GROUP BY x.organization_id, x.user_id
      HAVING COUNT(*) > 1
    ) d
    WHERE ur.organization_id = d.organization_id
      AND ur.user_id = d.user_id
      AND ur.role_id <> d.keep_role_id;
  `);
  await pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_org_user
      ON user_roles (organization_id, user_id);
  `);

  // ---------------------------------------------------------------------------
  // 6. manager_scopes — explicit team / department assignments for Admins.
  // ---------------------------------------------------------------------------
  await pgm.sql(`
    CREATE TABLE IF NOT EXISTS manager_scopes (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id  uuid NOT NULL REFERENCES organizations(id),
      user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scope_type       varchar(20) NOT NULL,
      scope_id         uuid NOT NULL,
      created_at       timestamptz NOT NULL DEFAULT now(),
      created_by       uuid REFERENCES users(id),
      CONSTRAINT uq_manager_scopes UNIQUE (organization_id, user_id, scope_type, scope_id),
      CONSTRAINT manager_scopes_type_check CHECK (scope_type IN ('team', 'department'))
    );
    CREATE INDEX IF NOT EXISTS idx_manager_scopes_user
      ON manager_scopes (organization_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_manager_scopes_scope
      ON manager_scopes (organization_id, scope_type, scope_id);
  `);
}

export async function down(pgm: any): Promise<void> {
  await pgm.sql(`DROP TABLE IF EXISTS manager_scopes;`);
  await pgm.sql(`DROP INDEX IF EXISTS uq_user_roles_org_user;`);

  // Restore the exact pre-migration role graph from the snapshot, if present.
  await pgm.sql(`
    DO $$
    BEGIN
      IF to_regclass('${UR_BACKUP}') IS NOT NULL
         AND EXISTS (SELECT 1 FROM ${UR_BACKUP}) THEN

        -- Recreate HR Manager per org that had one.
        INSERT INTO roles (organization_id, name, description, is_system)
        SELECT DISTINCT b.organization_id, 'HR Manager',
               'HR manager with employee and leave management access', TRUE
        FROM ${UR_BACKUP} b
        WHERE b.role_name = 'HR Manager'
        ON CONFLICT (organization_id, name) DO NOTHING;

        -- Restore every role's permission set exactly as snapshotted.
        DELETE FROM role_permissions
        WHERE role_id IN (SELECT id FROM roles);
        INSERT INTO role_permissions (organization_id, role_id, permission_id)
        SELECT DISTINCT b.organization_id, r.id, p.id
        FROM ${RP_BACKUP} b
        JOIN roles r ON r.organization_id = b.organization_id AND r.name = b.role_name
        JOIN permissions p ON p.code = b.permission_code
        ON CONFLICT (role_id, permission_id) DO NOTHING;

        -- Restore user_roles exactly (original ids preserved).
        DELETE FROM user_roles;
        INSERT INTO user_roles (id, organization_id, user_id, role_id, assigned_at, assigned_by)
        SELECT b.id, b.organization_id, b.user_id, r.id, b.assigned_at, b.assigned_by
        FROM ${UR_BACKUP} b
        JOIN roles r ON r.organization_id = b.organization_id AND r.name = b.role_name;

      END IF;
    END $$;
  `);

  // Remove the codes this migration introduced (cascades role_permissions).
  await pgm.sql(`
    DELETE FROM permissions WHERE code IN ('scope.all', 'role.assign');
  `);

  await pgm.sql(`DROP TABLE IF EXISTS ${UR_BACKUP};`);
  await pgm.sql(`DROP TABLE IF EXISTS ${RP_BACKUP};`);
}
