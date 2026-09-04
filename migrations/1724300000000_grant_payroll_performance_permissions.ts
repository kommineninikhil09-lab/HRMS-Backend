// The permission codes for Payroll and Performance were created by
// 1724080100000_add_payroll_permissions and 1724090100000_add_performance_permissions,
// but neither migration ever granted them to any role via role_permissions —
// confirmed live: even Admin got 403 "Missing required permissions:
// payroll.write" trying to create a salary structure. This grants a default
// matrix following the same Admin=ORGANIZATION / HR Manager=TEAM /
// Employee=SELF pattern established in 1724200000000_add_permission_scope;
// adjustable later like any other role_permissions data.

interface Grant {
  role: string;
  code: string;
  scope: 'ORGANIZATION' | 'TEAM' | 'SELF';
}

const GRANTS: Grant[] = [
  // Payroll
  { role: 'Admin', code: 'payroll.read', scope: 'ORGANIZATION' },
  { role: 'Admin', code: 'payroll.write', scope: 'ORGANIZATION' },
  { role: 'Admin', code: 'payroll.approve', scope: 'ORGANIZATION' },
  { role: 'Admin', code: 'payroll.process', scope: 'ORGANIZATION' },
  { role: 'Admin', code: 'payroll.export', scope: 'ORGANIZATION' },
  { role: 'HR Manager', code: 'payroll.read', scope: 'TEAM' },
  { role: 'HR Manager', code: 'payroll.approve', scope: 'TEAM' },
  { role: 'Employee', code: 'payroll.read', scope: 'SELF' },

  // Performance
  { role: 'Admin', code: 'performance.read', scope: 'ORGANIZATION' },
  { role: 'Admin', code: 'performance.write', scope: 'ORGANIZATION' },
  { role: 'Admin', code: 'performance.rate', scope: 'ORGANIZATION' },
  { role: 'Admin', code: 'performance.review', scope: 'ORGANIZATION' },
  { role: 'Admin', code: 'performance.finalize', scope: 'ORGANIZATION' },
  { role: 'Admin', code: 'performance.goals.read', scope: 'ORGANIZATION' },
  { role: 'Admin', code: 'performance.goals.write', scope: 'ORGANIZATION' },
  { role: 'Admin', code: 'performance.templates', scope: 'ORGANIZATION' },
  { role: 'Admin', code: 'performance.cycles', scope: 'ORGANIZATION' },
  { role: 'Admin', code: 'performance.export', scope: 'ORGANIZATION' },
  { role: 'HR Manager', code: 'performance.read', scope: 'TEAM' },
  { role: 'HR Manager', code: 'performance.write', scope: 'TEAM' },
  { role: 'HR Manager', code: 'performance.rate', scope: 'TEAM' },
  { role: 'HR Manager', code: 'performance.review', scope: 'TEAM' },
  { role: 'HR Manager', code: 'performance.goals.read', scope: 'TEAM' },
  { role: 'HR Manager', code: 'performance.goals.write', scope: 'TEAM' },
  { role: 'Employee', code: 'performance.read', scope: 'SELF' },
  { role: 'Employee', code: 'performance.rate', scope: 'SELF' },
  { role: 'Employee', code: 'performance.goals.read', scope: 'SELF' },
  { role: 'Employee', code: 'performance.goals.write', scope: 'SELF' },
];

const ALL_CODES = Array.from(new Set(GRANTS.map((g) => g.code)));

export async function up(pgm: any): Promise<void> {
  for (const g of GRANTS) {
    await pgm.sql(`
      INSERT INTO role_permissions (organization_id, role_id, permission_id, scope)
      SELECT r.organization_id, r.id, p.id, '${g.scope}'
      FROM roles r, permissions p
      WHERE r.name = '${g.role}' AND p.code = '${g.code}'
      ON CONFLICT (role_id, permission_id) DO UPDATE SET scope = EXCLUDED.scope;
    `);
  }
}

export async function down(pgm: any): Promise<void> {
  await pgm.sql(`
    DELETE FROM role_permissions rp
    USING permissions p
    WHERE rp.permission_id = p.id
      AND p.code IN (${ALL_CODES.map((c) => `'${c}'`).join(', ')});
  `);
}
