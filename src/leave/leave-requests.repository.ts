import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { TenantContext } from '../database/tenant-context';
import { Pool, PoolClient } from 'pg';

export interface LeaveRequest {
  id: string;
  organization_id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  reason?: string;
  status: string;
  approver_id?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class LeaveRequestsRepository extends BaseRepository {
  async create(
    tenantContext: TenantContext,
    data: Partial<LeaveRequest>,
    executor?: Pool | PoolClient,
  ): Promise<LeaveRequest> {
    const exe = executor || this.pool;
    const query = `
      INSERT INTO leave_requests (organization_id, employee_id, leave_type_id, start_date, end_date, duration_days, reason, status, approver_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await exe.query(query, [
      tenantContext.organizationId,
      data.employee_id,
      data.leave_type_id,
      data.start_date,
      data.end_date,
      data.duration_days,
      data.reason || null,
      data.status || 'draft',
      data.approver_id || null,
    ]);
    return result.rows[0];
  }

  async findById(
    tenantContext: TenantContext,
    id: string,
    executor?: Pool | PoolClient,
  ): Promise<LeaveRequest | null> {
    const exe = executor || this.pool;
    const query = `SELECT * FROM leave_requests WHERE organization_id = $1 AND id = $2`;
    const result = await exe.query(query, [tenantContext.organizationId, id]);
    return result.rows[0] || null;
  }

  async findByEmployee(
    tenantContext: TenantContext,
    employeeId: string,
    filters?: { status?: string; startDate?: string; endDate?: string },
    executor?: Pool | PoolClient,
  ): Promise<LeaveRequest[]> {
    const exe = executor || this.pool;
    let query = `SELECT * FROM leave_requests WHERE organization_id = $1 AND employee_id = $2`;
    const params: any[] = [tenantContext.organizationId, employeeId];

    if (filters?.status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }

    if (filters?.startDate) {
      query += ` AND start_date >= $${params.length + 1}`;
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      query += ` AND end_date <= $${params.length + 1}`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY start_date DESC`;
    const result = await exe.query(query, params);
    return result.rows;
  }

  async findPendingApprovals(
    tenantContext: TenantContext,
    approverId: string,
    executor?: Pool | PoolClient,
  ): Promise<LeaveRequest[]> {
    const exe = executor || this.pool;
    const query = `
      SELECT * FROM leave_requests
      WHERE organization_id = $1 AND approver_id = $2 AND status = 'submitted'
      ORDER BY start_date DESC
    `;
    const result = await exe.query(query, [tenantContext.organizationId, approverId]);
    return result.rows;
  }

  async findByDateRange(
    tenantContext: TenantContext,
    employeeId: string,
    startDate: string,
    endDate: string,
    executor?: Pool | PoolClient,
  ): Promise<LeaveRequest[]> {
    const exe = executor || this.pool;
    const query = `
      SELECT * FROM leave_requests
      WHERE organization_id = $1 AND employee_id = $2
        AND status IN ('approved', 'submitted')
        AND NOT (end_date < $3 OR start_date > $4)
      ORDER BY start_date
    `;
    const result = await exe.query(query, [
      tenantContext.organizationId,
      employeeId,
      startDate,
      endDate,
    ]);
    return result.rows;
  }

  async update(
    tenantContext: TenantContext,
    id: string,
    data: Partial<LeaveRequest>,
    executor?: Pool | PoolClient,
  ): Promise<LeaveRequest> {
    const exe = executor || this.pool;
    const fields: string[] = [];
    const values: any[] = [tenantContext.organizationId, id];
    let paramIndex = 3;

    if (data.status !== undefined) fields.push(`status = $${paramIndex++}`), values.push(data.status);
    if (data.approver_id !== undefined) fields.push(`approver_id = $${paramIndex++}`), values.push(data.approver_id);
    if (data.approved_at !== undefined) fields.push(`approved_at = $${paramIndex++}`), values.push(data.approved_at);
    if (data.rejection_reason !== undefined) fields.push(`rejection_reason = $${paramIndex++}`), values.push(data.rejection_reason);

    fields.push(`updated_at = now()`);

    const query = `
      UPDATE leave_requests
      SET ${fields.join(', ')}
      WHERE organization_id = $1 AND id = $2
      RETURNING *
    `;
    const result = await exe.query(query, values);
    return result.rows[0];
  }
}
