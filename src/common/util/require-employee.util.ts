import { ForbiddenException } from '@nestjs/common';
import { TenantContext } from '../../database/tenant-context';

/**
 * Asserts the current user has a linked employee record and returns its id.
 * Use in "my …" endpoints (my attendance, my leave, my profile) where an
 * employee id is required. Throws 403 for accounts with no employee profile.
 */
export function requireEmployeeId(tenantContext: TenantContext): string {
  if (!tenantContext.employeeId) {
    throw new ForbiddenException(
      'No employee profile is linked to your account.',
    );
  }
  return tenantContext.employeeId;
}
