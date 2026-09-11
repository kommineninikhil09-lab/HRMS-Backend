import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { TenantContext } from '../database/tenant-context';
import { Pool, PoolClient } from 'pg';

export interface Designations {
  id: string;
  organization_id: string;
  grade_id: string;
  title: string;
  code: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class DesignationsRepository extends BaseRepository {
  constructor(pool: Pool) { super(pool); }
  async create(tc: TenantContext, data: Partial<Designations>, ex?: Pool | PoolClient) {
    const r = await (ex || this.pool).query(`INSERT INTO designations (organization_id, grade_id, title, code, status, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [tc.organizationId, data.grade_id, data.title, data.code, data.status || 'active', tc.userId, tc.userId]);
    return r.rows[0];
  }
  async findById(tc: TenantContext, id: string, ex?: Pool | PoolClient) {
    const r = await (ex || this.pool).query(`SELECT * FROM designations WHERE id = $1 AND organization_id = $2`, [id, tc.organizationId]);
    return r.rows[0];
  }
  async findAll(tc: TenantContext, ex?: Pool | PoolClient) {
    const r = await (ex || this.pool).query(`SELECT * FROM designations WHERE organization_id = $1 ORDER BY title`, [tc.organizationId]);
    return r.rows;
  }
  async update(tc: TenantContext, id: string, data: Partial<Designations>, ex?: Pool | PoolClient) {
    const updates: string[] = [], values: any[] = [];
    let i = 1;
    if (data.grade_id) { updates.push(`grade_id = $${i++}`); values.push(data.grade_id); }
    if (data.title) { updates.push(`title = $${i++}`); values.push(data.title); }
    if (data.code) { updates.push(`code = $${i++}`); values.push(data.code); }
    if (data.status) { updates.push(`status = $${i++}`); values.push(data.status); }
    updates.push(`updated_at = now(), updated_by = $${i++}`);
    values.push(tc.userId, id, tc.organizationId);
    const r = await (ex || this.pool).query(`UPDATE designations SET ${updates.join(', ')} WHERE id = $${i-1} AND organization_id = $${i} RETURNING *`, values);
    return r.rows[0];
  }
  async delete(tc: TenantContext, id: string, ex?: Pool | PoolClient) {
    await (ex || this.pool).query(`DELETE FROM designations WHERE id = $1 AND organization_id = $2`, [id, tc.organizationId]);
  }
}





