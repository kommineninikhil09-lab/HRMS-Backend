import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { BaseRepository } from '../database/base.repository';

export interface CreateRoleData {
  organizationId: string;
  name: string;
  description?: string;
  isSystem?: boolean;
}

export interface Role {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

@Injectable()
export class RolesRepository extends BaseRepository {
  async create(
    data: CreateRoleData,
    executor: Pool | PoolClient = this.pool,
  ): Promise<Role> {
    const query = `
      INSERT INTO roles (organization_id, name, description, is_system)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [
      data.organizationId,
      data.name,
      data.description || null,
      data.isSystem || false,
    ];

    const result = await this.query<Role>(query, values, executor);
    return result.rows[0];
  }

  async findById(
    organizationId: string,
    roleId: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<Role | null> {
    const query = `
      SELECT * FROM roles
      WHERE organization_id = $1 AND id = $2
    `;

    return this.queryOne<Role>(query, [organizationId, roleId], executor);
  }

  async findByName(
    organizationId: string,
    name: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<Role | null> {
    const query = `
      SELECT * FROM roles
      WHERE organization_id = $1 AND name = $2
    `;

    return this.queryOne<Role>(query, [organizationId, name], executor);
  }

  async findByOrganization(
    organizationId: string,
    limit: number = 50,
    offset: number = 0,
    executor: Pool | PoolClient = this.pool,
  ): Promise<{ roles: Role[]; total: number }> {
    const countQuery = `SELECT COUNT(*) as total FROM roles WHERE organization_id = $1`;
    const dataQuery = `
      SELECT * FROM roles
      WHERE organization_id = $1
      ORDER BY name
      LIMIT $2 OFFSET $3
    `;

    const countResult = await this.query<{ total: string }>(
      countQuery,
      [organizationId],
      executor,
    );
    const dataResult = await this.query<Role>(
      dataQuery,
      [organizationId, limit, offset],
      executor,
    );

    return {
      roles: dataResult.rows,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  async update(
    organizationId: string,
    roleId: string,
    data: Partial<Omit<Role, 'id' | 'organizationId' | 'createdAt' | 'createdBy'>>,
    updatedBy: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<Role> {
    const setClauses: string[] = [];
    const values: any[] = [organizationId, roleId, updatedBy];
    let paramIndex = 4;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    setClauses.push('updated_at = NOW()');
    setClauses.push(`updated_by = $3`);

    const query = `
      UPDATE roles
      SET ${setClauses.join(', ')}
      WHERE organization_id = $1 AND id = $2
      RETURNING *
    `;

    const result = await this.query<Role>(query, values, executor);
    if (result.rows.length === 0) {
      throw new Error(`Role not found: ${roleId}`);
    }
    return result.rows[0];
  }

  async delete(
    organizationId: string,
    roleId: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<void> {
    const query = `DELETE FROM roles WHERE organization_id = $1 AND id = $2`;
    await this.query(query, [organizationId, roleId], executor);
  }
}
