import { Pool, PoolClient } from 'pg';
import {
  ManagementScope,
  ORG_SCOPE,
  SELF_SCOPE,
} from '../../database/tenant-context';

/**
 * Pure query helpers for authorization scope, taking an explicit executor so
 * they can run from a guard (with a raw pool) or a service (with a transaction
 * client) without any DI. `ScopeService` wraps these and adds CRUD + audit.
 */

const ORG_SCOPE_PERMISSION = 'scope.all';

/** Distinct permission codes granted to a user via any of their roles. */
export async function fetchEffectivePermissionCodes(
  executor: Pool | PoolClient,
  organizationId: string,
  userId: string,
): Promise<string[]> {
  const result = await executor.query<{ code: string }>(
    `
    SELECT DISTINCT p.code
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id AND r.organization_id = ur.organization_id
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.organization_id = $1 AND ur.user_id = $2
    `,
    [organizationId, userId],
  );
  return result.rows.map((row) => row.code);
}

/**
 * Resolve a principal's management scope: `scope.all` => organisation-wide;
 * otherwise the union of employees covered by their `manager_scopes` rows;
 * no rows => `self` (fail-closed).
 */
export async function fetchManagementScope(
  executor: Pool | PoolClient,
  organizationId: string,
  userId: string,
  effectivePermissions: string[],
): Promise<ManagementScope> {
  if (effectivePermissions.includes(ORG_SCOPE_PERMISSION)) return ORG_SCOPE;

  const { rows } = await executor.query<{
    scope_type: 'team' | 'department';
    scope_id: string;
  }>(
    `SELECT scope_type, scope_id FROM manager_scopes
     WHERE organization_id = $1 AND user_id = $2`,
    [organizationId, userId],
  );
  if (rows.length === 0) return SELF_SCOPE;

  const teamIds = rows
    .filter((r) => r.scope_type === 'team')
    .map((r) => r.scope_id);
  const deptIds = rows
    .filter((r) => r.scope_type === 'department')
    .map((r) => r.scope_id);

  const employees = await executor.query<{ id: string }>(
    `
    SELECT DISTINCT e.id
    FROM employees e
    WHERE e.organization_id = $1
      AND e.status = 'active'
      AND (
        e.team_id = ANY($2::uuid[])
        OR e.department_id = ANY($3::uuid[])
        OR e.team_id IN (
          SELECT t.id FROM teams t
          WHERE t.organization_id = $1 AND t.department_id = ANY($3::uuid[])
        )
      )
    `,
    [organizationId, teamIds, deptIds],
  );

  return { kind: 'team', employeeIds: new Set(employees.rows.map((r) => r.id)) };
}
