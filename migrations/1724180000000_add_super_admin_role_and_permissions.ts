/**
 * Super Admin role + a couple of admin permission codes.
 *
 * Reworked (Stage 1 reconciliation) to be compatible with the F0 foundation
 * schema in `1723500000000_create_foundation`. The original version of this
 * migration re-created `roles` / `permissions` / `role_permissions` /
 * `user_roles` with a different shape (`permissions.name`, `roles.deleted_at`,
 * no `organization_id` on the join tables) and never applied anywhere.
 *
 * F0 already owns those tables:
 *   - permissions: (id, code UNIQUE, description, module, created_at)  -- global catalogue, no organization_id
 *   - roles: (id, organization_id, name, description, is_system, ...)  -- UNIQUE(organization_id, name)
 *   - role_permissions: (id, organization_id, role_id, permission_id)  -- UNIQUE(role_id, permission_id)
 *   - user_roles: (id, organization_id, user_id, role_id, ...)         -- UNIQUE(user_id, role_id)
 *
 * This migration therefore only:
 *   1. adds two new admin permission codes (see ADDED_PERMISSIONS),
 *   2. creates a "Super Admin" system role for every existing organisation,
 *   3. grants that role every permission in the catalogue.
 * It creates no tables and never touches `permissions.name` or `deleted_at`.
 */

// The only permission codes this migration introduces. `down()` removes exactly
// these and nothing else.
const ADDED_PERMISSIONS: Array<[code: string, description: string, module: string]> =
  [
    ['admin.access', 'Access administrative functions', 'admin'],
    ['settings.manage', 'Manage organisation settings', 'settings'],
  ];

export async function up(pgm: any): Promise<void> {
  // 1. New permission codes — idempotent.
  for (const [code, description, module] of ADDED_PERMISSIONS) {
    await pgm.sql(`
      INSERT INTO permissions (code, description, module)
      VALUES ('${code}', '${description}', '${module}')
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  // 2. A "Super Admin" system role per organisation, respecting
  //    UNIQUE(organization_id, name).
  await pgm.sql(`
    INSERT INTO roles (organization_id, name, description, is_system)
    SELECT o.id, 'Super Admin', 'Full access to every permission', TRUE
    FROM organizations o
    ON CONFLICT (organization_id, name) DO NOTHING;
  `);

  // 3. Grant the Super Admin role every permission, scoped per organisation.
  //    Idempotent via UNIQUE(role_id, permission_id).
  await pgm.sql(`
    INSERT INTO role_permissions (organization_id, role_id, permission_id)
    SELECT r.organization_id, r.id, p.id
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.name = 'Super Admin'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  `);
}

export async function down(pgm: any): Promise<void> {
  const codes = ADDED_PERMISSIONS.map(([code]) => `'${code}'`).join(', ');

  await pgm.sql(`
    -- Remove Super Admin assignments and the role itself (role_permissions /
    -- user_roles also cascade on roles delete, but be explicit).
    DELETE FROM user_roles
    WHERE role_id IN (SELECT id FROM roles WHERE name = 'Super Admin');

    DELETE FROM role_permissions
    WHERE role_id IN (SELECT id FROM roles WHERE name = 'Super Admin');

    DELETE FROM roles
    WHERE name = 'Super Admin' AND is_system = TRUE;

    -- Remove only the permission codes this migration added.
    DELETE FROM permissions WHERE code IN (${codes});
  `);
}
