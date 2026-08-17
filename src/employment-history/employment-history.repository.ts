import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { TenantContext } from '../database/tenant-context';
import { Pool, PoolClient } from 'pg';

export interface EmploymentHistory {
  id: string;
  organization_id: string;
  employee_id: string;
  event_type: string;
  effective_date: Date;
  previous_value?: any;
  new_value?: any;
  reason?: string;
  created_by?: string;
  created_at: Date;
}

@Injectable()
export class EmploymentHistoryRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async record(tenantContext: TenantContext, data: Partial<EmploymentHistory>, executor?: Pool | PoolClient) {
    const query = `
      INSERT INTO employment_history (
        organization_id, employee_id, event_type, effective_date,
        previous_value, new_value, reason, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      tenantContext.organizationId,
      data.employee_id,
      data.event_type,
      data.effective_date,
      data.previous_value ? JSON.stringify(data.previous_value) : null,
      data.new_value ? JSON.stringify(data.new_value) : null,
      data.reason || null,
      tenantContext.userId,
    ];
    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as EmploymentHistory;
  }

  async getByEmployee(tenantContext: TenantContext, employeeId: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM employment_history
      WHERE employee_id = $1 AND organization_id = $2
      ORDER BY effective_date DESC
    `;
    const result = await (executor || this.pool).query(query, [employeeId, tenantContext.organizationId]);
    return result.rows as EmploymentHistory[];
  }
}
