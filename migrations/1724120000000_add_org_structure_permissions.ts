export async function up(pgm: any): Promise<void> {
  const permissions = [
    {
      code: 'organization_structure.read',
      description: 'View organization structure (business units, locations, departments, teams, grades, designations, cost centers)',
      module: 'organization',
    },
    {
      code: 'organization_structure.write',
      description: 'Create, update and delete organization structure entities',
      module: 'organization',
    },
  ];

  for (const permission of permissions) {
    await pgm.sql(`
      INSERT INTO permissions (code, description, module)
      VALUES ('${permission.code}', '${permission.description}', '${permission.module}')
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  // read → every role; write → Admin + HR Manager.
  await pgm.sql(`
    INSERT INTO role_permissions (organization_id, role_id, permission_id)
    SELECT r.organization_id, r.id, p.id
    FROM roles r
    CROSS JOIN permissions p
    WHERE p.code = 'organization_structure.read'
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    INSERT INTO role_permissions (organization_id, role_id, permission_id)
    SELECT r.organization_id, r.id, p.id
    FROM roles r
    CROSS JOIN permissions p
    WHERE p.code = 'organization_structure.write'
      AND r.name IN ('Admin', 'HR Manager')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  `);
}

export async function down(pgm: any): Promise<void> {
  await pgm.sql(
    `DELETE FROM permissions WHERE code IN ('organization_structure.read', 'organization_structure.write');`,
  );
}
