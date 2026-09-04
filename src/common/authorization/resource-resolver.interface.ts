import { TenantContext } from '../../database/tenant-context';

/**
 * Implemented by each resource-keyed resolver (PayrollSlipResolver,
 * DocumentResolver, AppraisalResolver, GoalResolver, LeaveRequestResolver —
 * built per-module in Phase 1 as each module is retrofitted). Maps a
 * resource id (e.g. a payroll slip id) to the employee id it belongs to, so
 * ScopeGuard can run the normal scope check against that employee id.
 *
 * Returns `null` when the resource genuinely doesn't exist (organization-
 * scoped) — ScopeGuard treats that as 404, distinct from a 403 scope denial.
 */
export interface ResourceResolver {
  resolveEmployeeId(tenantContext: TenantContext, resourceId: string): Promise<string | null>;
}
