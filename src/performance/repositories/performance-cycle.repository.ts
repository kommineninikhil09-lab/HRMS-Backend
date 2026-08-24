import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class PerformanceCycleRepository extends BaseRepository {
  async create(
    tenantContext: TenantContext,
    data: any,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      INSERT INTO performance_cycles
      (organization_id, name, cycle_type, start_date, end_date, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, now(), now())
      RETURNING *;
    `;

    return this.queryOne<any>(
      sql,
      [
        tenantContext.organizationId,
        data.name,
        data.cycle_type,
        data.start_date,
        data.end_date,
        data.status || 'draft',
      ],
      executor,
    );
  }

  async findById(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const sql = `
      SELECT * FROM performance_cycles
      WHERE id = $1 AND organization_id = $2;
    `;

    return this.queryOne<any>(sql, [id, tenantContext.organizationId], executor);
  }

  async findAll(tenantContext: TenantContext, executor?: Pool | PoolClient) {
    const sql = `
      SELECT * FROM performance_cycles
      WHERE organization_id = $1
      ORDER BY start_date DESC;
    `;

    return this.query<any>(sql, [tenantContext.organizationId], executor);
  }

  async findByStatus(
    tenantContext: TenantContext,
    status: string,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      SELECT * FROM performance_cycles
      WHERE organization_id = $1 AND status = $2
      ORDER BY start_date DESC;
    `;

    return this.query<any>(sql, [tenantContext.organizationId, status], executor);
  }

  async update(
    tenantContext: TenantContext,
    id: string,
    data: any,
    executor?: Pool | PoolClient,
  ) {
    const updates: string[] = [];
    const values: any[] = [tenantContext.organizationId, id];
    let paramCount = 2;

    if (data.name) {
      updates.push(`name = $${++paramCount}`);
      values.push(data.name);
    }
    if (data.status) {
      updates.push(`status = $${++paramCount}`);
      values.push(data.status);
    }
    if (data.end_date) {
      updates.push(`end_date = $${++paramCount}`);
      values.push(data.end_date);
    }

    updates.push(`updated_at = now()`);

    const sql = `
      UPDATE performance_cycles
      SET ${updates.join(', ')}
      WHERE id = $2 AND organization_id = $1
      RETURNING *;
    `;

    return this.queryOne<any>(sql, values, executor);
  }
}
