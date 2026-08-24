import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { TenantContext } from '../database/tenant-context';
import { Pool, PoolClient } from 'pg';

export interface Location {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  timezone: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

@Injectable()
export class LocationsRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(tenantContext: TenantContext, data: Partial<Location>, executor?: Pool | PoolClient) {
    const query = `
      INSERT INTO locations (organization_id, name, code, address, city, state, country, postal_code, timezone, status, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const values = [
      tenantContext.organizationId,
      data.name,
      data.code,
      data.address || null,
      data.city || null,
      data.state || null,
      data.country || null,
      data.postal_code || null,
      data.timezone || 'UTC',
      data.status || 'active',
      tenantContext.userId,
      tenantContext.userId,
    ];
    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as Location;
  }

  async findById(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM locations
      WHERE id = $1 AND organization_id = $2
    `;
    const result = await (executor || this.pool).query(query, [id, tenantContext.organizationId]);
    return result.rows[0] as Location | undefined;
  }

  async findAll(tenantContext: TenantContext, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM locations
      WHERE organization_id = $1
      ORDER BY name
    `;
    const result = await (executor || this.pool).query(query, [tenantContext.organizationId]);
    return result.rows as Location[];
  }

  async update(tenantContext: TenantContext, id: string, data: Partial<Location>, executor?: Pool | PoolClient) {
    const updates = [] as any[];
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
    if (data.timezone !== undefined) {
      updates.push(`timezone = $${paramIndex}`);
      values.push(data.timezone);
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
      UPDATE locations
      SET ${updates.join(', ')}
      WHERE id = $1 AND organization_id = $2
      RETURNING *
    `;
    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as Location | undefined;
  }

  async delete(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      DELETE FROM locations
      WHERE id = $1 AND organization_id = $2
    `;
    await (executor || this.pool).query(query, [id, tenantContext.organizationId]);
  }
}



