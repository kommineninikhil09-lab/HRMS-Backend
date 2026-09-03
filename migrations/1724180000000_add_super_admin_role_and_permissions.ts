export async function up(pgm: any) {
  // Create roles table if not exists
  pgm.createTable(
    'roles',
    {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
      },
      organization_id: {
        type: 'uuid',
        notNull: true,
      },
      name: {
        type: 'varchar(255)',
        notNull: true,
      },
      description: {
        type: 'text',
      },
      created_at: {
        type: 'timestamp',
        notNull: true,
        default: pgm.func('now()'),
      },
      updated_at: {
        type: 'timestamp',
        notNull: true,
        default: pgm.func('now()'),
      },
      deleted_at: {
        type: 'timestamp',
      },
    },
    {
      ifNotExists: true,
    },
  );

  // Create permissions table if not exists
  pgm.createTable(
    'permissions',
    {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
      },
      name: {
        type: 'varchar(255)',
        notNull: true,
        unique: true,
      },
      description: {
        type: 'text',
      },
      created_at: {
        type: 'timestamp',
        notNull: true,
        default: pgm.func('now()'),
      },
    },
    {
      ifNotExists: true,
    },
  );

  // Create role_permissions table if not exists
  pgm.createTable(
    'role_permissions',
    {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
      },
      role_id: {
        type: 'uuid',
        notNull: true,
      },
      permission_id: {
        type: 'uuid',
        notNull: true,
      },
      updated_at: {
        type: 'timestamp',
        notNull: true,
        default: pgm.func('now()'),
      },
    },
    {
      ifNotExists: true,
    },
  );

  // Create user_roles table if not exists
  pgm.createTable(
    'user_roles',
    {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
      },
      user_id: {
        type: 'uuid',
        notNull: true,
      },
      role_id: {
        type: 'uuid',
        notNull: true,
      },
      assigned_at: {
        type: 'timestamp',
        notNull: true,
        default: pgm.func('now()'),
      },
      updated_at: {
        type: 'timestamp',
        notNull: true,
        default: pgm.func('now()'),
      },
    },
    {
      ifNotExists: true,
    },
  );

  // Insert default permissions
  pgm.sql(`
    INSERT INTO permissions (name, description) VALUES
    ('admin.access', 'Access to admin panel'),
    ('users.list', 'List all users'),
    ('users.create', 'Create new users'),
    ('users.edit', 'Edit user details'),
    ('users.delete', 'Delete users'),
    ('users.manage', 'Manage users'),
    ('roles.list', 'List all roles'),
    ('roles.create', 'Create new roles'),
    ('roles.edit', 'Edit roles'),
    ('roles.delete', 'Delete roles'),
    ('roles.manage', 'Manage roles and permissions'),
    ('permissions.manage', 'Manage permissions'),
    ('audit.view', 'View audit logs'),
    ('settings.manage', 'Manage system settings')
    ON CONFLICT (name) DO NOTHING
  `);

  // Insert roles for each organization
  pgm.sql(`
    INSERT INTO roles (organization_id, name, description)
    SELECT DISTINCT organization_id, 'Super Admin', 'Super Admin with full access'
    FROM users
    WHERE deleted_at IS NULL
    ON CONFLICT DO NOTHING
  `);

  pgm.sql(`
    INSERT INTO roles (organization_id, name, description)
    SELECT DISTINCT organization_id, 'Admin', 'Administrator'
    FROM users
    WHERE deleted_at IS NULL
    ON CONFLICT DO NOTHING
  `);

  pgm.sql(`
    INSERT INTO roles (organization_id, name, description)
    SELECT DISTINCT organization_id, 'Manager', 'Manager'
    FROM users
    WHERE deleted_at IS NULL
    ON CONFLICT DO NOTHING
  `);

  // Assign Super Admin role to users with Super Admin permission
  pgm.sql(`
    INSERT INTO user_roles (user_id, role_id)
    SELECT u.id, r.id
    FROM users u
    JOIN roles r ON r.organization_id = u.organization_id
    WHERE r.name = 'Super Admin'
    AND u.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
    )
    ON CONFLICT DO NOTHING
  `);

  // Assign all permissions to Super Admin role
  pgm.sql(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r, permissions p
    WHERE r.name = 'Super Admin'
    AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
    )
    ON CONFLICT DO NOTHING
  `);

  // Assign limited permissions to Admin role
  pgm.sql(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r, permissions p
    WHERE r.name = 'Admin'
    AND p.name IN ('admin.access', 'users.list', 'users.create', 'users.edit', 'users.delete', 'audit.view')
    AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
    )
    ON CONFLICT DO NOTHING
  `);
}

export async function down(pgm: any) {
  pgm.dropTable('user_roles', { ifExists: true });
  pgm.dropTable('role_permissions', { ifExists: true });
  pgm.dropTable('permissions', { ifExists: true });
  pgm.dropTable('roles', { ifExists: true });
}
