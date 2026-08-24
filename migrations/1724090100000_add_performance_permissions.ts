export async function up(pgm: any): Promise<void> {
  const permissions = [
    {
      code: 'performance.read',
      description: 'View performance appraisals and feedback',
      module: 'Performance',
    },
    {
      code: 'performance.write',
      description: 'Create and edit appraisals and templates',
      module: 'Performance',
    },
    {
      code: 'performance.rate',
      description: 'Provide ratings and feedback in appraisals',
      module: 'Performance',
    },
    {
      code: 'performance.review',
      description: 'Review and approve performance appraisals',
      module: 'Performance',
    },
    {
      code: 'performance.finalize',
      description: 'Finalize and close performance appraisals',
      module: 'Performance',
    },
    {
      code: 'performance.goals.read',
      description: 'View performance goals',
      module: 'Performance',
    },
    {
      code: 'performance.goals.write',
      description: 'Create and manage performance goals',
      module: 'Performance',
    },
    {
      code: 'performance.templates',
      description: 'Manage appraisal templates and competencies',
      module: 'Performance',
    },
    {
      code: 'performance.cycles',
      description: 'Create and manage performance cycles',
      module: 'Performance',
    },
    {
      code: 'performance.export',
      description: 'Export performance reports and appraisals',
      module: 'Performance',
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
    'performance.read',
    'performance.write',
    'performance.rate',
    'performance.review',
    'performance.finalize',
    'performance.goals.read',
    'performance.goals.write',
    'performance.templates',
    'performance.cycles',
    'performance.export',
  ];

  for (const code of codes) {
    await pgm.sql(`DELETE FROM permissions WHERE code = '${code}';`);
  }
}
