import { BadRequestException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { EmployeesRepository } from '../../employees/employees.repository';
import { TenantContext } from '../../database/tenant-context';

/**
 * Shared approval helpers used by request-and-approve flows (leave now;
 * attendance regularization / WFH / expenses later). Deliberately small — a
 * generic multi-step approval engine is only worth it once several features
 * need it (structural decision #6).
 */

/**
 * Resolve the approver for an employee's request as a **user id**
 * (`*.approver_id` columns reference `users(id)`), walking employee → manager →
 * manager's linked user. Returns `null` when the employee has no manager or the
 * manager has no linked user account.
 */
export async function resolveApproverUserId(
  employeesRepo: EmployeesRepository,
  tenantContext: TenantContext,
  employee: { manager_id?: string | null },
  executor?: Pool | PoolClient,
): Promise<string | null> {
  if (!employee.manager_id) return null;
  const manager = await employeesRepo.findById(
    tenantContext,
    employee.manager_id,
    executor,
  );
  return manager?.user_id ?? null;
}

/**
 * Fallback approver when an employee has no (usable) reporting manager: any
 * active user in the organisation who holds a given approval permission, chosen
 * deterministically. Role-based — no hardcoded users. Returns `null` when the
 * org has nobody who can approve.
 */
export async function resolveFallbackApproverUserId(
  executor: Pool | PoolClient,
  organizationId: string,
  permissionCode: string,
  excludeUserId?: string,
): Promise<string | null> {
  const result = await executor.query<{ user_id: string }>(
    `
    SELECT ur.user_id
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id AND r.organization_id = ur.organization_id
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    JOIN users u ON u.id = ur.user_id
    WHERE ur.organization_id = $1
      AND p.code = $2
      AND u.status = 'active'
      AND ($3::uuid IS NULL OR ur.user_id <> $3::uuid)
    ORDER BY u.created_at, u.id
    LIMIT 1
    `,
    [organizationId, permissionCode, excludeUserId ?? null],
  );
  return result.rows[0]?.user_id ?? null;
}

/** Assert a record is in one of the allowed statuses before acting on it. */
export function assertStatus(
  current: string,
  allowed: string[],
  action = 'action',
): void {
  if (!allowed.includes(current)) {
    throw new BadRequestException(
      `Cannot ${action} a request in "${current}" status`,
    );
  }
}
