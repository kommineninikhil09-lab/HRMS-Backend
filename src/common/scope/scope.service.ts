import {
  Injectable,
  Inject,
  Optional,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { POOL_PROVIDER } from '../../database/pool.provider';
import { TransactionService } from '../../database/transaction.service';
import { AuditService } from '../../audit/audit.service';
import { ManagementScope, TenantContext } from '../../database/tenant-context';
import {
  fetchEffectivePermissionCodes,
  fetchManagementScope,
} from './scope.queries';

export type ScopeType = 'team' | 'department';
export interface ManagerScopeEntry {
  scope_type: ScopeType;
  scope_id: string;
}
export interface ManagerScopeRow extends ManagerScopeEntry {
  id: string;
  scope_name: string | null;
}

const ORG_SCOPE_PERMISSION = 'scope.all';

/**
 * Owns everything about *who* a principal may act on:
 *   - resolving effective permission codes (single canonical query),
 *   - resolving the request's {@link ManagementScope} from `manager_scopes`,
 *   - CRUD for a user's `manager_scopes` assignments.
 *
 * Pure decision helpers (`assertActingOnEmployee`, `scopedEmployeeIds`) live in
 * `scope.util.ts` so domain services don't need to inject this.
 */
@Injectable()
export class ScopeService {
  constructor(
    @Inject(POOL_PROVIDER) private readonly pool: Pool,
    private readonly transactionService: TransactionService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Resolution (used by JwtAuthGuard)
  // ---------------------------------------------------------------------------

  /** Distinct permission codes granted to the user via any of their roles. */
  getEffectivePermissionCodes(
    organizationId: string,
    userId: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<string[]> {
    return fetchEffectivePermissionCodes(executor, organizationId, userId);
  }

  /**
   * Resolve the management scope for a request. `scope.all` short-circuits to
   * org-wide; otherwise the union of the employees covered by the user's
   * `manager_scopes` rows; an Admin with no rows manages nobody (`self`).
   */
  resolveScope(
    organizationId: string,
    userId: string,
    effectivePermissions: string[],
    executor: Pool | PoolClient = this.pool,
  ): Promise<ManagementScope> {
    return fetchManagementScope(
      executor,
      organizationId,
      userId,
      effectivePermissions,
    );
  }

  // ---------------------------------------------------------------------------
  // manager_scopes CRUD (used by the scope-management API)
  // ---------------------------------------------------------------------------

  async listScopes(
    organizationId: string,
    userId: string,
  ): Promise<ManagerScopeRow[]> {
    const { rows } = await this.pool.query<ManagerScopeRow>(
      `
      SELECT ms.id, ms.scope_type, ms.scope_id,
             COALESCE(t.name, d.name) AS scope_name
      FROM manager_scopes ms
      LEFT JOIN teams t       ON t.id = ms.scope_id AND ms.scope_type = 'team'
      LEFT JOIN departments d ON d.id = ms.scope_id AND ms.scope_type = 'department'
      WHERE ms.organization_id = $1 AND ms.user_id = $2
      ORDER BY ms.scope_type, scope_name NULLS LAST
      `,
      [organizationId, userId],
    );
    return rows;
  }

  /** Replace a user's entire scope set (the shape the management UI edits). */
  async replaceScopes(
    tenantContext: TenantContext,
    targetUserId: string,
    entries: ManagerScopeEntry[],
  ): Promise<ManagerScopeRow[]> {
    await this.assertUserInOrg(tenantContext.organizationId, targetUserId);
    for (const e of entries) {
      await this.assertScopeTargetExists(
        tenantContext.organizationId,
        e.scope_type,
        e.scope_id,
      );
    }

    await this.transactionService.runInTransaction(async (client) => {
      await client.query(
        `DELETE FROM manager_scopes WHERE organization_id = $1 AND user_id = $2`,
        [tenantContext.organizationId, targetUserId],
      );
      for (const e of entries) {
        await client.query(
          `INSERT INTO manager_scopes (organization_id, user_id, scope_type, scope_id, created_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (organization_id, user_id, scope_type, scope_id) DO NOTHING`,
          [
            tenantContext.organizationId,
            targetUserId,
            e.scope_type,
            e.scope_id,
            tenantContext.userId,
          ],
        );
      }
      await this.audit(tenantContext, 'UPDATE', targetUserId, { scopes: entries }, client);
    });

    return this.listScopes(tenantContext.organizationId, targetUserId);
  }

  async addScope(
    tenantContext: TenantContext,
    targetUserId: string,
    entry: ManagerScopeEntry,
  ): Promise<ManagerScopeRow[]> {
    await this.assertUserInOrg(tenantContext.organizationId, targetUserId);
    await this.assertScopeTargetExists(
      tenantContext.organizationId,
      entry.scope_type,
      entry.scope_id,
    );
    await this.pool.query(
      `INSERT INTO manager_scopes (organization_id, user_id, scope_type, scope_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (organization_id, user_id, scope_type, scope_id) DO NOTHING`,
      [
        tenantContext.organizationId,
        targetUserId,
        entry.scope_type,
        entry.scope_id,
        tenantContext.userId,
      ],
    );
    await this.audit(tenantContext, 'CREATE', targetUserId, entry);
    return this.listScopes(tenantContext.organizationId, targetUserId);
  }

  async removeScope(
    tenantContext: TenantContext,
    targetUserId: string,
    scopeRowId: string,
  ): Promise<ManagerScopeRow[]> {
    const result = await this.pool.query(
      `DELETE FROM manager_scopes
       WHERE id = $1 AND organization_id = $2 AND user_id = $3`,
      [scopeRowId, tenantContext.organizationId, targetUserId],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException('Scope assignment not found');
    }
    await this.audit(tenantContext, 'DELETE', targetUserId, { id: scopeRowId });
    return this.listScopes(tenantContext.organizationId, targetUserId);
  }

  // ---------------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------------

  private async assertUserInOrg(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM users WHERE id = $1 AND organization_id = $2`,
      [userId, organizationId],
    );
    if (!rowCount) throw new NotFoundException('User not found');
  }

  private async assertScopeTargetExists(
    organizationId: string,
    scopeType: ScopeType,
    scopeId: string,
  ): Promise<void> {
    const table = scopeType === 'team' ? 'teams' : 'departments';
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM ${table} WHERE id = $1 AND organization_id = $2`,
      [scopeId, organizationId],
    );
    if (!rowCount) {
      throw new BadRequestException(
        `${scopeType} ${scopeId} does not exist in this organization`,
      );
    }
  }

  private async audit(
    tenantContext: TenantContext,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    targetUserId: string,
    value: Record<string, any>,
    executor?: Pool | PoolClient,
  ): Promise<void> {
    if (!this.auditService) return;
    await this.auditService.record(
      tenantContext,
      {
        action,
        entity_type: 'ManagerScope',
        entity_id: targetUserId,
        new_value: value,
      },
      executor,
    );
  }
}
