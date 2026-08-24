export async function up(pgm: any): Promise<void> {
  // Add all permissions first (global, not org-specific)
  await pgm.sql(`
    INSERT INTO permissions (id, code, description, module, created_at)
    VALUES
      (gen_random_uuid(), 'admin.access', 'Access admin panel and features', 'admin', now()),
      (gen_random_uuid(), 'users.list', 'View list of users', 'user_management', now()),
      (gen_random_uuid(), 'users.create', 'Create new users', 'user_management', now()),
      (gen_random_uuid(), 'users.edit', 'Edit user details', 'user_management', now()),
      (gen_random_uuid(), 'users.delete', 'Delete/deactivate users', 'user_management', now()),
      (gen_random_uuid(), 'users.manage', 'Full user management - assign/remove roles', 'user_management', now()),
      (gen_random_uuid(), 'roles.list', 'View list of roles', 'role_management', now()),
      (gen_random_uuid(), 'roles.create', 'Create custom roles', 'role_management', now()),
      (gen_random_uuid(), 'roles.edit', 'Edit roles', 'role_management', now()),
      (gen_random_uuid(), 'roles.delete', 'Delete roles', 'role_management', now()),
      (gen_random_uuid(), 'roles.manage', 'Full role management', 'role_management', now()),
      (gen_random_uuid(), 'permissions.manage', 'Manage permissions', 'permissions', now()),
      (gen_random_uuid(), 'audit.view', 'View audit logs', 'audit', now()),
      (gen_random_uuid(), 'settings.manage', 'Manage system settings', 'settings', now())
    ON CONFLICT (code) DO NOTHING;
  `);

  // Add Super Admin roles for each organization
  await pgm.sql(`
    INSERT INTO roles (id, organization_id, name, description, is_system, created_at)
    SELECT gen_random_uuid(), o.id, 'Super Admin', 'Full system access - can manage all users, roles, and settings', true, now()
    FROM organizations o
    WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = 'Super Admin' AND r.organization_id = o.id)
    ON CONFLICT DO NOTHING;
  `);

  // Add other admin roles
  await pgm.sql(`
    INSERT INTO roles (id, organization_id, name, description, is_system, created_at)
    SELECT gen_random_uuid(), o.id, 'Admin (HR)', 'HR administration - manage employees, leaves, documents', true, now()
    FROM organizations o
    WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = 'Admin (HR)' AND r.organization_id = o.id)
    ON CONFLICT DO NOTHING;
  `);

  await pgm.sql(`
    INSERT INTO roles (id, organization_id, name, description, is_system, created_at)
    SELECT gen_random_uuid(), o.id, 'Admin (Finance)', 'Finance administration - manage payroll, expenses, assets', true, now()
    FROM organizations o
    WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = 'Admin (Finance)' AND r.organization_id = o.id)
    ON CONFLICT DO NOTHING;
  `);

  await pgm.sql(`
    INSERT INTO roles (id, organization_id, name, description, is_system, created_at)
    SELECT gen_random_uuid(), o.id, 'Admin (Operations)', 'Operations administration - manage organization structure, planning', true, now()
    FROM organizations o
    WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = 'Admin (Operations)' AND r.organization_id = o.id)
    ON CONFLICT DO NOTHING;
  `);

  await pgm.sql(`
    INSERT INTO roles (id, organization_id, name, description, is_system, created_at)
    SELECT gen_random_uuid(), o.id, 'Manager', 'Team manager - manage team members, approve leaves/expenses', true, now()
    FROM organizations o
    WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = 'Manager' AND r.organization_id = o.id)
    ON CONFLICT DO NOTHING;
  `);

  // Assign all permissions to Super Admin role
  await pgm.sql(`
    INSERT INTO role_permissions (id, role_id, permission_id, organization_id)
    SELECT gen_random_uuid(), r.id, p.id, r.organization_id
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.name = 'Super Admin' AND r.is_system = true
    ON CONFLICT DO NOTHING;
  `);

  // Assign limited permissions to Admin (HR)
  await pgm.sql(`
    INSERT INTO role_permissions (id, role_id, permission_id, organization_id)
    SELECT gen_random_uuid(), r.id, p.id, r.organization_id
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.name = 'Admin (HR)' AND r.is_system = true
    AND p.code IN ('admin.access', 'users.list', 'users.create', 'users.edit', 'users.delete', 'audit.view')
    ON CONFLICT DO NOTHING;
  `);

  // Add assigned_by column to user_roles if it doesn't exist
  await pgm.sql(`
    ALTER TABLE user_roles
    ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_at timestamp DEFAULT now(),
    ADD COLUMN IF NOT EXISTS reason text;
  `);
}

export async function down(pgm: any): Promise<void> {
  // Remove columns
  await pgm.sql(`
    ALTER TABLE user_roles
    DROP COLUMN IF EXISTS assigned_by,
    DROP COLUMN IF EXISTS assigned_at,
    DROP COLUMN IF EXISTS reason;
  `);

  // Remove role_permissions for system roles
  await pgm.sql(`
    DELETE FROM role_permissions
    WHERE role_id IN (
      SELECT id FROM roles
      WHERE is_system = true
      AND name IN ('Super Admin', 'Admin (HR)', 'Admin (Finance)', 'Admin (Operations)', 'Manager')
    );
  `);

  // Remove roles
  await pgm.sql(`
    DELETE FROM roles
    WHERE is_system = true
    AND name IN ('Super Admin', 'Admin (HR)', 'Admin (Finance)', 'Admin (Operations)', 'Manager');
  `);

  // Remove permissions
  await pgm.sql(`
    DELETE FROM permissions
    WHERE code IN (
      'admin.access', 'users.list', 'users.create', 'users.edit', 'users.delete', 'users.manage',
      'roles.list', 'roles.create', 'roles.edit', 'roles.delete', 'roles.manage',
      'permissions.manage', 'audit.view', 'settings.manage'
    );
  `);
}
