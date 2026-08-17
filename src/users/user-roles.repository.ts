import { Injectable, Inject } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { POOL_PROVIDER } from '../database/pool.provider';

export interface UserRole {
  id: string;
  organizationId: string;
  userId: string;
  roleId: string;
  assignedAt: Date;
  assignedBy: string | null;
}

@Injectable()
export class UserRolesRepository {
  constructor(@Inject(POOL_PROVIDER) private pool: Pool) {}

  /**
   * Assign a role to a user
   */
  async assignRoleToUser(
    organizationId: string,
    userId: string,
    roleId: string,
    assignedBy?: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<UserRole> {
    const query = `
      INSERT INTO user_roles (organization_id, user_id, role_id, assigned_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, role_id) DO UPDATE SET organization_id = $1
      RETURNING *
    `;

    const result = await executor.query<UserRole>(query, [
      organizationId,
      userId,
      roleId,
      assignedBy || null,
    ]);

    return result.rows[0];
  }

  /**
   * Remove a role from a user
   */
  async removeRoleFromUser(
    userId: string,
    roleId: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<void> {
    const query = `
      DELETE FROM user_roles
      WHERE user_id = $1 AND role_id = $2
    `;

    await executor.query(query, [userId, roleId]);
  }

  /**
   * Get roles assigned to a user
   */
  async getUserRoles(
    organizationId: string,
    userId: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<{ id: string; name: string; description: string | null }[]> {
    const query = `
      SELECT r.id, r.name, r.description
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.organization_id = $1 AND ur.user_id = $2
      ORDER BY r.name
    `;

    const result = await executor.query<{
      id: string;
      name: string;
      description: string | null;
    }>(query, [organizationId, userId]);

    return result.rows;
  }
}
