import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';

export interface SalaryStructure {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class SalaryStructureRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(
    tenantContext: TenantContext,
    data: Omit<SalaryStructure, 'id' | 'created_at' | 'updated_at'>,
    executor?: Pool | PoolClient,
  ): Promise<SalaryStructure> {
    const sql = `
      INSERT INTO salary_structures (organization_id, name, code, description, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await this.query<SalaryStructure>(
      sql,
      [
        tenantContext.organizationId,
        data.name,
        data.code,
        data.description || null,
        data.is_active ?? true,
      ],
      executor,
    );
    return result.rows[0];
  }

  async findById(
    tenantContext: TenantContext,
    id: string,
    executor?: Pool | PoolClient,
  ): Promise<SalaryStructure | null> {
    return this.queryOne<SalaryStructure>(
      'SELECT * FROM salary_structures WHERE id = $1 AND organization_id = $2',
      [id, tenantContext.organizationId],
      executor,
    );
  }

  async findAll(
    tenantContext: TenantContext,
    executor?: Pool | PoolClient,
  ): Promise<SalaryStructure[]> {
    const result = await this.query<SalaryStructure>(
      'SELECT * FROM salary_structures WHERE organization_id = $1 ORDER BY name ASC',
      [tenantContext.organizationId],
      executor,
    );
    return result.rows;
  }

  async update(
    tenantContext: TenantContext,
    id: string,
    data: Partial<SalaryStructure>,
    executor?: Pool | PoolClient,
  ): Promise<SalaryStructure> {
    const fields: string[] = [];
    const values: any[] = [tenantContext.organizationId, id];
    let paramCount = 3;

    if (data.name) {
      fields.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.code) {
      fields.push(`code = $${paramCount++}`);
      values.push(data.code);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(data.description);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(data.is_active);
    }

    fields.push('updated_at = now()');

    const sql = `
      UPDATE salary_structures
      SET ${fields.join(', ')}
      WHERE id = $2 AND organization_id = $1
      RETURNING *
    `;
    const result = await this.query<SalaryStructure>(sql, values, executor);
    return result.rows[0];
  }

  async delete(
    tenantContext: TenantContext,
    id: string,
    executor?: Pool | PoolClient,
  ): Promise<void> {
    await this.query(
      'DELETE FROM salary_structures WHERE id = $1 AND organization_id = $2',
      [id, tenantContext.organizationId],
      executor,
    );
  }
}
