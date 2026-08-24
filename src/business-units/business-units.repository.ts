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
}

@Injectable()
export class BusinessUnitsRepository extends BaseRepository {
  constructor(pool: Pool) { super(pool); }
  async create(tc: TenantContext, data: Partial<BusinessUnit>, ex?: Pool | PoolClient) {
    const r = await (ex || this.pool).query(`INSERT INTO business_units (organization_id, name, code, parent_business_unit_id, status, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [tc.organizationId, data.name, data.code, data.parent_business_unit_id || null, data.status || 'active', tc.userId, tc.userId]);
    return r.rows[0];
  }
  async findById(tc: TenantContext, id: string, ex?: Pool | PoolClient) {
    const r = await (ex || this.pool).query(`SELECT * FROM business_units WHERE id = $1 AND organization_id = $2`, [id, tc.organizationId]);
    return r.rows[0];
  }
  async findAll(tc: TenantContext, ex?: Pool | PoolClient) {
    const r = await (ex || this.pool).query(`SELECT * FROM business_units WHERE organization_id = $1 ORDER BY name`, [tc.organizationId]);
    return r.rows;
  }
  async update(tc: TenantContext, id: string, data: Partial<BusinessUnit>, ex?: Pool | PoolClient) {
    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (data.name) { updates.push(`name = $${i++}`); values.push(data.name); }
    if (data.code) { updates.push(`code = $${i++}`); values.push(data.code); }
    if (data.status) { updates.push(`status = $${i++}`); values.push(data.status); }
    updates.push(`updated_at = now(), updated_by = $${i++}`);
    values.push(tc.userId, id, tc.organizationId);
    const r = await (ex || this.pool).query(`UPDATE business_units SET ${updates.join(', ')} WHERE id = $${i-1} AND organization_id = $${i} RETURNING *`, values);
    return r.rows[0];
  }
  async delete(tc: TenantContext, id: string, ex?: Pool | PoolClient) {
    await (ex || this.pool).query(`DELETE FROM business_units WHERE id = $1 AND organization_id = $2`, [id, tc.organizationId]);
  }
}


