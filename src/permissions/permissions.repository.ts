import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { BaseRepository } from '../database/base.repository';

export interface Permission {
  id: string;
  code: string;
  description: string | null;
  module: string | null;
  createdAt: Date;
}

@Injectable()
export class PermissionsRepository extends BaseRepository {
  async create(
    data: { code: string; description?: string; module?: string },
    executor: Pool | PoolClient = this.pool,
  ): Promise<Permission> {
    const query = `
      INSERT INTO permissions (code, description, module)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const values = [data.code, data.description || null, data.module || null];

    const result = await this.query<Permission>(query, values, executor);
    return result.rows[0];
  }

  async findById(
    id: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<Permission | null> {
    const query = `SELECT * FROM permissions WHERE id = $1`;
    return this.queryOne<Permission>(query, [id], executor);
  }

  async findByCode(
    code: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<Permission | null> {
    const query = `SELECT * FROM permissions WHERE code = $1`;
    return this.queryOne<Permission>(query, [code], executor);
  }

  async findByCodes(
    codes: string[],
    executor: Pool | PoolClient = this.pool,
  ): Promise<Permission[]> {
    if (codes.length === 0) return [];

    const placeholders = codes.map((_, i) => `$${i + 1}`).join(',');
    const query = `SELECT * FROM permissions WHERE code IN (${placeholders})`;
    const result = await this.query<Permission>(query, codes, executor);
    return result.rows;
  }

  async findAll(
    limit: number = 1000,
    offset: number = 0,
    executor: Pool | PoolClient = this.pool,
  ): Promise<{ permissions: Permission[]; total: number }> {
    const countQuery = `SELECT COUNT(*) as total FROM permissions`;
    const dataQuery = `
      SELECT * FROM permissions
      ORDER BY module, code
      LIMIT $1 OFFSET $2
    `;

    const countResult = await this.query<{ total: string }>(
      countQuery,
      [],
      executor,
    );
    const dataResult = await this.query<Permission>(
      dataQuery,
      [limit, offset],
      executor,
    );

    return {
      permissions: dataResult.rows,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  async findByModule(
    module: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<Permission[]> {
    const query = `
      SELECT * FROM permissions
      WHERE module = $1
      ORDER BY code
    `;

    const result = await this.query<Permission>(query, [module], executor);
    return result.rows;
  }
}
