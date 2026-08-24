import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class PerformanceGoalRepository extends BaseRepository {
  async create(
    tenantContext: TenantContext,
    data: any,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      INSERT INTO performance_goals
      (organization_id, employee_id, cycle_id, appraisal_id, goal_title, goal_description, goal_category, target_date, status, owner_id, reviewer_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
      RETURNING *;
    `;

    return this.queryOne<any>(
      sql,
      [
        tenantContext.organizationId,
        data.employee_id,
        data.cycle_id,
        data.appraisal_id,
        data.goal_title,
        data.goal_description,
        data.goal_category,
        data.target_date,
        data.status || 'open',
        data.owner_id || tenantContext.userId,
        data.reviewer_id,
      ],
      executor,
    );
  }

  async findById(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const sql = `
      SELECT * FROM performance_goals
      WHERE id = $1 AND organization_id = $2;
    `;

    return this.queryOne<any>(sql, [id, tenantContext.organizationId], executor);
  }

  async findByEmployee(
    tenantContext: TenantContext,
    employeeId: string,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      SELECT * FROM performance_goals
      WHERE organization_id = $1 AND employee_id = $2
      ORDER BY created_at DESC;
    `;

    return this.query<any>(sql, [tenantContext.organizationId, employeeId], executor);
  }

  async findByEmployeeAndCycle(
    tenantContext: TenantContext,
    employeeId: string,
    cycleId: string,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      SELECT * FROM performance_goals
      WHERE organization_id = $1 AND employee_id = $2 AND cycle_id = $3
      ORDER BY created_at DESC;
    `;

    return this.query<any>(sql, [tenantContext.organizationId, employeeId, cycleId], executor);
  }

  async findByStatus(
    tenantContext: TenantContext,
    status: string,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      SELECT * FROM performance_goals
      WHERE organization_id = $1 AND status = $2
      ORDER BY created_at DESC;
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

    if (data.goal_title) {
      updates.push(`goal_title = $${++paramCount}`);
      values.push(data.goal_title);
    }
    if (data.goal_description) {
      updates.push(`goal_description = $${++paramCount}`);
      values.push(data.goal_description);
    }
    if (data.status) {
      updates.push(`status = $${++paramCount}`);
      values.push(data.status);
    }
    if (data.progress_percentage !== undefined) {
      updates.push(`progress_percentage = $${++paramCount}`);
      values.push(data.progress_percentage);
    }
    if (data.completion_date) {
      updates.push(`completion_date = $${++paramCount}`);
      values.push(data.completion_date);
    }

    updates.push(`updated_at = now()`);

    const sql = `
      UPDATE performance_goals
      SET ${updates.join(', ')}
      WHERE id = $2 AND organization_id = $1
      RETURNING *;
    `;

    return this.queryOne<any>(sql, values, executor);
  }
}
