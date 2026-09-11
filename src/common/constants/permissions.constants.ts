export const PERMISSIONS = {
  // Users
  USER_READ: 'user.read',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',

  // Roles
  ROLE_READ: 'role.read',
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',
  ROLE_ASSIGN: 'role.assign',

  // Permissions
  PERMISSION_READ: 'permission.read',

  // Organizations
  ORGANIZATION_READ: 'organization.read',
  ORGANIZATION_UPDATE: 'organization.update',

  // Organization structure (business units, locations, departments, teams,
  // grades, designations, cost centers)
  ORG_STRUCTURE_READ: 'organization_structure.read',
  ORG_STRUCTURE_WRITE: 'organization_structure.write',

  // Employees
  EMPLOYEE_READ: 'employee.read',
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_UPDATE: 'employee.update',
  EMPLOYEE_DELETE: 'employee.delete',
  EMPLOYEE_DIRECTORY_READ: 'employee.directory.read',
  EMPLOYEE_SENSITIVE_READ: 'employee.sensitive.read',

  // Sensitive
  SALARY_READ: 'salary.read',
  SALARY_UPDATE: 'salary.update',

  // Attendance
  ATTENDANCE_READ: 'attendance.read',
  ATTENDANCE_WRITE: 'attendance.write',
  ATTENDANCE_MANAGE: 'attendance.manage',

  // Leave
  LEAVE_READ: 'leave.read',
  LEAVE_WRITE: 'leave.write',
  LEAVE_APPROVE: 'leave.approve',

  // ESS (Employee Self-Service)
  ESS_READ: 'ess.read',
  ESS_UPDATE: 'ess.update',

  // Holidays
  HOLIDAY_READ: 'holiday.read',
  HOLIDAY_WRITE: 'holiday.write',

  // Audit
  AUDIT_READ: 'audit.read',

  // Management scope — organization-wide (Super Admin). Absence + no
  // manager_scopes rows => self-only. Never checked by role name.
  SCOPE_ALL: 'scope.all',
} as const;

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS];
