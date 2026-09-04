import { Inject, Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Pool } from 'pg';
import { POOL_PROVIDER } from '../../database/pool.provider';
import { TenantContext } from '../../database/tenant-context';
import { EmployeesService } from '../../employees/employees.service';

export type Scope = 'SELF' | 'TEAM' | 'ORGANIZATION';
export type ScopedEmployeeIds = 'ALL' | string[];

const SCOPE_RANK: Record<Scope, number> = { SELF: 0, TEAM: 1, ORGANIZATION: 2 };

/**
 * RBAC + Scope authorization primitive (implementation.md Part 6).
 *
 * A permission code (e.g. `employee.read`) grants the right to attempt an
 * action; its scope (`SELF` / `TEAM` / `ORGANIZATION`) bounds which employee
 * records the caller may act on. This service resolves a user's effective
 * scope for a permission and checks/filters against it. It never trusts a
 * target employee id supplied by the caller without checking it against the
 * resolved scope first (implementation.md §2.6).
 */
@Injectable()
export class ScopeService {
  constructor(
    @Inject(POOL_PROVIDER) private readonly pool: Pool,
    private readonly employeesService: EmployeesService,
  ) {}

  /** Widest scope across all the user's roles for a given permission. `null` means no permission at all (deny). */
  async getEffectiveScope(tenantContext: TenantContext, permissionCode: string): Promise<Scope | null> {
    const query = `
      SELECT DISTINCT rp.scope
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.organization_id = $1
        AND ur.user_id = $2
        AND r.organization_id = $1
        AND p.code = $3
    `;
    const result = await this.pool.query<{ scope: Scope }>(query, [
      tenantContext.organizationId,
      tenantContext.userId,
      permissionCode,
    ]);

    if (result.rows.length === 0) return null;

    return result.rows.reduce<Scope>(
      (widest, row) => (SCOPE_RANK[row.scope] > SCOPE_RANK[widest] ? row.scope : widest),
      'SELF',
    );
  }

  /** Employee ids the user can see under TEAM scope: direct reports, or the full recursive subtree by default. */
  async getSubordinateIds(
    tenantContext: TenantContext,
    managerUserId: string,
    opts: { direct?: boolean } = {},
  ): Promise<string[]> {
    const manager = await this.employeesService.getByUserId(tenantContext, managerUserId);
    if (!manager) return [];

    return opts.direct
      ? this.employeesService.getDirectReportIds(tenantContext, manager.id)
      : this.employeesService.getSubtreeIds(tenantContext, manager.id);
  }

  /**
   * For a single target employee — throws if the caller is not allowed to act on it.
   * `opts.directOnly` narrows TEAM scope to direct reports only, for routes like leave
   * approval where the approval chain should not skip levels even though TEAM's default
   * definition is the full recursive subtree (implementation.md §6.1).
   */
  async assertEmployeeInScope(
    tenantContext: TenantContext,
    permissionCode: string,
    targetEmployeeId: string,
    opts: { directOnly?: boolean } = {},
  ): Promise<void> {
    const scope = await this.getEffectiveScope(tenantContext, permissionCode);
    if (scope === null) {
      throw new UnauthorizedException(`Missing permission: ${permissionCode}`);
    }
    if (scope === 'ORGANIZATION') return;

    const caller = await this.employeesService.getByUserId(tenantContext, tenantContext.userId);
    if (!caller) {
      throw new UnauthorizedException('Caller is not linked to an employee record');
    }

    if (scope === 'SELF') {
      if (caller.id !== targetEmployeeId) {
        throw new ForbiddenException('Target employee is outside your SELF scope');
      }
      return;
    }

    // scope === 'TEAM' — reuse the caller record already resolved above rather
    // than routing through getSubordinateIds(), which would re-resolve it.
    const subordinateIds = opts.directOnly
      ? await this.employeesService.getDirectReportIds(tenantContext, caller.id)
      : await this.employeesService.getSubtreeIds(tenantContext, caller.id);
    if (!subordinateIds.includes(targetEmployeeId)) {
      throw new ForbiddenException('Target employee is outside your TEAM scope');
    }
  }

  /** For list endpoints — produces the filter set to pass down to the repository's WHERE clause. */
  async getScopedEmployeeIds(tenantContext: TenantContext, permissionCode: string): Promise<ScopedEmployeeIds> {
    const scope = await this.getEffectiveScope(tenantContext, permissionCode);
    if (scope === null) {
      throw new UnauthorizedException(`Missing permission: ${permissionCode}`);
    }
    if (scope === 'ORGANIZATION') return 'ALL';

    const caller = await this.employeesService.getByUserId(tenantContext, tenantContext.userId);
    if (!caller) {
      throw new UnauthorizedException('Caller is not linked to an employee record');
    }
    if (scope === 'SELF') return [caller.id];

    // scope === 'TEAM' — managers see themselves plus their team. Call
    // getSubtreeIds directly with the already-resolved caller id rather than
    // routing through getSubordinateIds(), which would re-resolve it.
    const subordinateIds = await this.employeesService.getSubtreeIds(tenantContext, caller.id);
    return [caller.id, ...subordinateIds];
  }
}
