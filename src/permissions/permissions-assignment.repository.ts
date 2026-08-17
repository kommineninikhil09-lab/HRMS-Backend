import { Injectable, Inject } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { POOL_PROVIDER } from '../database/pool.provider';

export interface RolePermissionAssignment {
  id: string;
  organizationId: string;
  roleId: string;
  permissionId: string;
}

@Injectable()
export class PermissionsAssignmentRepository {
  constructor(@Inject(POOL_PROVIDER) private pool: Pool) {}

  /**
   * Assign a permission to a role
   */
  async assignPermissionToRole(
    organizationId: string,
    roleId: string,
    permissionId: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<RolePermissionAssignment> {
    const query = `
      INSERT INTO role_permissions (organization_id, role_id, permission_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (role_id, permission_id) DO UPDATE SET organization_id = $1
      RETURNING *
    `;

    const result = await executor.query<RolePermissionAssignment>(query, [
      organizationId,
      roleId,
      permissionId,
    ]);

    return result.rows[0];
  }

  /**
   * Assign multiple permissions to a role
   */
  async assignPermissionsToRole(
    organizationId: string,
    roleId: string,
    permissionIds: string[],
    executor: Pool | PoolClient = this.pool,
  ): Promise<RolePermissionAssignment[]> {
    if (permissionIds.length === 0) {
      return [];
    }

    const placeholders = permissionIds
      .map((_, i) => `($1, $2, $${i + 3})`)
      .join(',');

    const query = `
      INSERT INTO role_permissions (organization_id, role_id, permission_id)
      VALUES ${placeholders}
      ON CONFLICT (role_id, permission_id) DO UPDATE SET organization_id = $1
      RETURNING *
    `;

    const values = [organizationId, roleId, ...permissionIds];
    const result = await executor.query<RolePermissionAssignment>(
      query,
      values,
    );

    return result.rows;
  }

  /**
   * Revoke a permission from a role
   */
  async revokePermissionFromRole(
    roleId: string,
    permissionId: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<void> {
    const query = `
      DELETE FROM role_permissions
      WHERE role_id = $1 AND permission_id = $2
    `;

    await executor.query(query, [roleId, permissionId]);
  }

  /**
   * Get permissions assigned to a role
   */
  async getRolePermissions(
    roleId: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<{ code: string; description: string | null }[]> {
    const query = `
      SELECT p.code, p.description
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1
      ORDER BY p.code
    `;

    const result = await executor.query<{ code: string; description: string | null }>(
      query,
      [roleId],
    );

    return result.rows;
  }
}
