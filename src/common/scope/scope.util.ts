import { ForbiddenException } from '@nestjs/common';
import { TenantContext } from '../../database/tenant-context';

/** Never-matches sentinel so a "self only" filter is never an empty `IN ()`. */
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Guard for endpoints that act on another employee (read history, mark
 * attendance, view a leave balance, …). Pure — the scope is already resolved
 * onto `tenantContext.scope` by `JwtAuthGuard`.
 *
 *  - `org` scope           → always allowed.
 *  - acting on **yourself** → always allowed (management scope never blocks
 *    self-service, even through an admin route).
 *  - `team` scope          → allowed only if the target is in the resolved set.
 *  - `self` / unresolved   → denied for anyone but yourself.
 */
export function assertActingOnEmployee(
  tenantContext: TenantContext,
  targetEmployeeId: string,
): void {
  const scope = tenantContext.scope ?? { kind: 'self' as const };

  if (scope.kind === 'org') return;
  if (
    tenantContext.employeeId != null &&
    targetEmployeeId === tenantContext.employeeId
  ) {
    return;
  }
  if (scope.kind === 'team' && scope.employeeIds.has(targetEmployeeId)) return;

  throw new ForbiddenException(
    'This employee is outside your management scope',
  );
}

/**
 * Employee-id allow-list for list endpoints.
 *
 *  - `org`  → `null` (no filter; caller lists the whole organisation).
 *  - `team` → the resolved set plus the caller's own employee id.
 *  - `self` / unresolved → just the caller's own id (or a nil sentinel).
 */
export function scopedEmployeeIds(
  tenantContext: TenantContext,
): string[] | null {
  const scope = tenantContext.scope ?? { kind: 'self' as const };
  const self = tenantContext.employeeId ? [tenantContext.employeeId] : [];

  if (scope.kind === 'org') return null;
  if (scope.kind === 'team') {
    return Array.from(new Set([...scope.employeeIds, ...self]));
  }
  return self.length > 0 ? self : [NIL_UUID];
}
