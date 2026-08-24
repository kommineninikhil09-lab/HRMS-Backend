
export async function up(pgm: any): Promise<void> {
  const permissions = [
    {
      code: 'attendance.read',
      description: 'View attendance records',
      module: 'Attendance',
    },
    {
      code: 'attendance.write',
      description: 'Clock in/out and manage personal attendance',
      module: 'Attendance',
    },
    {
      code: 'attendance.manage',
      description: 'Mark attendance for employees',
      module: 'Attendance',
    },
    {
      code: 'leave.read',
      description: 'View leave requests and balance',
      module: 'Leave',
    },
    {
      code: 'leave.write',
      description: 'Create and manage leave requests',
      module: 'Leave',
    },
    {
      code: 'leave.approve',
      description: 'Approve or reject leave requests',
      module: 'Leave',
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
    'attendance.read',
    'attendance.write',
    'attendance.manage',
    'leave.read',
    'leave.write',
    'leave.approve',
  ];

  for (const code of codes) {
    await pgm.sql(`DELETE FROM permissions WHERE code = '${code}';`);
  }
}

