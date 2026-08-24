import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class PerformanceAppraisalRepository extends BaseRepository {
  async create(
    tenantContext: TenantContext,
    data: any,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      INSERT INTO performance_appraisals
      (organization_id, cycle_id, employee_id, template_id, manager_id, status, appraisal_type, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
      RETURNING *;
    `;

    return this.queryOne<any>(
      sql,
      [
        tenantContext.organizationId,
        data.cycle_id,
        data.employee_id,
        data.template_id,
        data.manager_id,
        data.status || 'draft',
        data.appraisal_type,
        tenantContext.userId,
      ],
      executor,
    );
  }

  async findById(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const sql = `
      SELECT * FROM performance_appraisals
      WHERE id = $1 AND organization_id = $2;
    `;

    return this.queryOne<any>(sql, [id, tenantContext.organizationId], executor);
  }

  async findByEmployeeAndCycle(
    tenantContext: TenantContext,
    employeeId: string,
    cycleId: string,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      SELECT * FROM performance_appraisals
      WHERE organization_id = $1 AND employee_id = $2 AND cycle_id = $3;
    `;

    return this.query<any>(sql, [tenantContext.organizationId, employeeId, cycleId], executor);
  }

  async findByCycle(
    tenantContext: TenantContext,
    cycleId: string,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      SELECT * FROM performance_appraisals
      WHERE organization_id = $1 AND cycle_id = $2
      ORDER BY created_at DESC;
    `;

    return this.query<any>(sql, [tenantContext.organizationId, cycleId], executor);
  }

  async findByStatus(
    tenantContext: TenantContext,
    status: string,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      SELECT * FROM performance_appraisals
      WHERE organization_id = $1 AND status = $2
      ORDER BY created_at DESC;
    `;

    return this.query<any>(sql, [tenantContext.organizationId, status], executor);
  }

  async findByEmployee(
    tenantContext: TenantContext,
    employeeId: string,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      SELECT * FROM performance_appraisals
      WHERE organization_id = $1 AND employee_id = $2
      ORDER BY created_at DESC;
    `;

    return this.query<any>(sql, [tenantContext.organizationId, employeeId], executor);
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

    if (data.status) {
      updates.push(`status = $${++paramCount}`);
      values.push(data.status);
    }
    if (data.overall_rating !== undefined) {
      updates.push(`overall_rating = $${++paramCount}`);
      values.push(data.overall_rating);
    }
    if (data.self_rating !== undefined) {
      updates.push(`self_rating = $${++paramCount}`);
      values.push(data.self_rating);
    }
    if (data.manager_rating !== undefined) {
      updates.push(`manager_rating = $${++paramCount}`);
      values.push(data.manager_rating);
    }
    if (data.peer_rating !== undefined) {
      updates.push(`peer_rating = $${++paramCount}`);
      values.push(data.peer_rating);
    }
    if (data.manager_comments) {
      updates.push(`manager_comments = $${++paramCount}`);
      values.push(data.manager_comments);
    }
    if (data.submitted_by) {
      updates.push(`submitted_by = $${++paramCount}`);
      values.push(data.submitted_by);
      updates.push(`submitted_at = now()`);
    }
    if (data.reviewed_by) {
      updates.push(`reviewed_by = $${++paramCount}`);
      values.push(data.reviewed_by);
      updates.push(`reviewed_at = now()`);
    }
    if (data.finalized_by) {
      updates.push(`finalized_by = $${++paramCount}`);
      values.push(data.finalized_by);
      updates.push(`finalized_at = now()`);
    }

    updates.push(`updated_at = now()`);

    const sql = `
      UPDATE performance_appraisals
      SET ${updates.join(', ')}
      WHERE id = $2 AND organization_id = $1
      RETURNING *;
    `;

    return this.queryOne<any>(sql, values, executor);
  }
}
