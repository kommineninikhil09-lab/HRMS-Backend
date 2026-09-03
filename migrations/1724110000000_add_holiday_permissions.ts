export async function up(pgm: any): Promise<void> {
  const permissions = [
    {
      code: 'holiday.read',
      description: 'View the holiday calendar',
      module: 'holiday',
    },
    {
      code: 'holiday.write',
      description: 'Create and remove holidays',
      module: 'holiday',
    },
  ];

  for (const permission of permissions) {
    await pgm.sql(`
      INSERT INTO permissions (code, description, module)
      VALUES ('${permission.code}', '${permission.description}', '${permission.module}')
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  // Grant holiday.read to every role, holiday.write to Admin + HR Manager.
  await pgm.sql(`
    INSERT INTO role_permissions (organization_id, role_id, permission_id)
    SELECT r.organization_id, r.id, p.id
    FROM roles r
    CROSS JOIN permissions p
    WHERE p.code = 'holiday.read'
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    INSERT INTO role_permissions (organization_id, role_id, permission_id)
    SELECT r.organization_id, r.id, p.id
    FROM roles r
    CROSS JOIN permissions p
    WHERE p.code = 'holiday.write'
      AND r.name IN ('Admin', 'HR Manager')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  `);
}

export async function down(pgm: any): Promise<void> {
  await pgm.sql(
    `DELETE FROM permissions WHERE code IN ('holiday.read', 'holiday.write');`,
  );
}
