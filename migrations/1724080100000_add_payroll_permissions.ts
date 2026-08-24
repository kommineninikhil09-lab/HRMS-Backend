export async function up(pgm: any): Promise<void> {
  const permissions = [
    {
      code: 'payroll.read',
      description: 'View payroll and salary information',
      module: 'Payroll',
    },
    {
      code: 'payroll.write',
      description: 'Manage salary structures and assignments',
      module: 'Payroll',
    },
    {
      code: 'payroll.process',
      description: 'Generate and process salary slips',
      module: 'Payroll',
    },
    {
      code: 'payroll.approve',
      description: 'Approve salary slips for payment',
      module: 'Payroll',
    },
    {
      code: 'payroll.export',
      description: 'Export payroll reports and data',
      module: 'Payroll',
    },
  ];

  for (const permission of permissions) {
    await pgm.sql(`
      INSERT INTO permissions (code, description, module)
      VALUES ('${permission.code}', '${permission.description}', '${permission.module}')
      ON CONFLICT (code) DO NOTHING;
    `);
  }
}

export async function down(pgm: any): Promise<void> {
  const codes = [
    'payroll.read',
    'payroll.write',
    'payroll.process',
    'payroll.approve',
    'payroll.export',
  ];

  for (const code of codes) {
    await pgm.sql(`DELETE FROM permissions WHERE code = '${code}';`);
  }
}
