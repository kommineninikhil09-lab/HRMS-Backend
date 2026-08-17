import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { TenantContext } from '../database/tenant-context';
import { Pool, PoolClient } from 'pg';

export interface BusinessUnit {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  parent_business_unit_id?: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

@Injectable()
export class BusinessUnitsRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(tenantContext: TenantContext, data: Partial<BusinessUnit>, executor?: Pool | PoolClient) {
    const query = `
      INSERT INTO business_units (organization_id, name, code, parent_business_unit_id, status, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      tenantContext.organizationId,
      data.name,
      data.code,
      data.parent_business_unit_id || null,
      data.status || 'active',
      tenantContext.userId,
      tenantContext.userId,
    ];
    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as BusinessUnit;
  }

  async findById(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM business_units
      WHERE id = $1 AND organization_id = $2
    `;
    const result = await (executor || this.pool).query(query, [id, tenantContext.organizationId]);
    return result.rows[0] as BusinessUnit | undefined;
  }

  async findByCode(tenantContext: TenantContext, code: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM business_units
      WHERE code = $1 AND organization_id = $2
    `;
    const result = await (executor || this.pool).query(query, [code, tenantContext.organizationId]);
    return result.rows[0] as BusinessUnit | undefined;
  }

  async findAll(tenantContext: TenantContext, filters?: { status?: string }, executor?: Pool | PoolClient) {
    let query = `SELECT * FROM business_units WHERE organization_id = $1`;
    const values: any[] = [tenantContext.organizationId];
    let paramIndex = 2;

    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }

    query += ` ORDER BY name`;
    const result = await (executor || this.pool).query(query, values);
    return result.rows as BusinessUnit[];
  }

  async findByParent(tenantContext: TenantContext, parentId: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM business_units
      WHERE parent_business_unit_id = $1 AND organization_id = $2
      ORDER BY name
    `;
    const result = await (executor || this.pool).query(query, [parentId, tenantContext.organizationId]);
    return result.rows as BusinessUnit[];
  }

  async update(tenantContext: TenantContext, id: string, data: Partial<BusinessUnit>, executor?: Pool | PoolClient) {
    const updates: string[] = [];
    const values: any[] = [id, tenantContext.organizationId];
    let paramIndex = 3;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(data.name);
      paramIndex++;
    }
    if (data.code !== undefined) {
      updates.push(`code = $${paramIndex}`);
      values.push(data.code);
      paramIndex++;
    }
    if (data.parent_business_unit_id !== undefined) {
      updates.push(`parent_business_unit_id = $${paramIndex}`);
      values.push(data.parent_business_unit_id || null);
      paramIndex++;
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(data.status);
      paramIndex++;
    }

    updates.push(`updated_by = $${paramIndex}`);
    values.push(tenantContext.userId);
    paramIndex++;

    updates.push(`updated_at = now()`);

    const query = `
      UPDATE business_units
      SET ${updates.join(', ')}
      WHERE id = $1 AND organization_id = $2
      RETURNING *
    `;
    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as BusinessUnit | undefined;
  }

  async delete(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      DELETE FROM business_units
      WHERE id = $1 AND organization_id = $2
    `;
    await (executor || this.pool).query(query, [id, tenantContext.organizationId]);
  }
}
