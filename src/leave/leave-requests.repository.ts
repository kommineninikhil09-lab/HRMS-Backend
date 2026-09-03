import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { TenantContext } from '../database/tenant-context';
import { toIsoDate } from '../common/util/date.util';
import { Pool, PoolClient } from 'pg';

export interface LeaveRequest {
  id: string;
  organization_id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  half_day_option: string;
  reason?: string;
  status: string;
  approver_id?: string;
  approved_at?: string;
  rejection_reason?: string;
  cancelled_at?: string;
  notify_user_ids?: string[];
  created_at: string;
  updated_at: string;
  // Joined display fields (present on list/detail reads)
  leave_type_name?: string;
  leave_type_code?: string;
  employee_name?: string;
  approver_name?: string;
}

/** DATE columns → `YYYY-MM-DD`; NUMERIC `duration_days` → number. */
function toModel(row: any): LeaveRequest {
  if (!row) return row;
  return {
    ...row,
    start_date: toIsoDate(row.start_date),
    end_date: toIsoDate(row.end_date),
    duration_days: Number(row.duration_days),
  };
}

// Common SELECT with the display joins used by list/detail reads.
const SELECT_WITH_JOINS = `
  SELECT
    lr.*,
    lt.name AS leave_type_name,
    lt.code AS leave_type_code,
    NULLIF(TRIM(COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, '')), '') AS employee_name,
    NULLIF(TRIM(COALESCE(au.first_name, '') || ' ' || COALESCE(au.last_name, '')), '') AS approver_name
  FROM leave_requests lr
  JOIN leave_types lt ON lt.id = lr.leave_type_id
  JOIN employees e ON e.id = lr.employee_id
  LEFT JOIN users au ON au.id = lr.approver_id
`;

@Injectable()
export class LeaveRequestsRepository extends BaseRepository {
  async create(
    tenantContext: TenantContext,
    data: Partial<LeaveRequest>,
    executor?: Pool | PoolClient,
  ): Promise<LeaveRequest> {
    const exe = executor || this.pool;
    const query = `
      INSERT INTO leave_requests (
        organization_id, employee_id, leave_type_id, start_date, end_date,
        duration_days, half_day_option, reason, status, approver_id, notify_user_ids
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const result = await exe.query(query, [
      tenantContext.organizationId,
      data.employee_id,
      data.leave_type_id,
      data.start_date,
      data.end_date,
      data.duration_days,
      data.half_day_option || 'full_day',
      data.reason || null,
      data.status || 'draft',
      data.approver_id || null,
      data.notify_user_ids || [],
    ]);
    return toModel(result.rows[0]);
  }

  async findById(
    tenantContext: TenantContext,
    id: string,
    executor?: Pool | PoolClient,
  ): Promise<LeaveRequest | null> {
    const exe = executor || this.pool;
    const result = await exe.query(
      `${SELECT_WITH_JOINS} WHERE lr.organization_id = $1 AND lr.id = $2`,
      [tenantContext.organizationId, id],
    );
    return result.rows[0] ? toModel(result.rows[0]) : null;
  }

  async findByEmployee(
    tenantContext: TenantContext,
    employeeId: string,
    filters?: { status?: string; startDate?: string; endDate?: string },
    executor?: Pool | PoolClient,
  ): Promise<LeaveRequest[]> {
    const exe = executor || this.pool;
    let query = `${SELECT_WITH_JOINS} WHERE lr.organization_id = $1 AND lr.employee_id = $2`;
    const params: any[] = [tenantContext.organizationId, employeeId];

    if (filters?.status) {
      query += ` AND lr.status = $${params.length + 1}`;
      params.push(filters.status);
    }
    if (filters?.startDate) {
      query += ` AND lr.start_date >= $${params.length + 1}`;
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ` AND lr.end_date <= $${params.length + 1}`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY lr.start_date DESC`;
    const result = await exe.query(query, params);
    return result.rows.map(toModel);
  }

  async findPendingApprovals(
    tenantContext: TenantContext,
    approverId: string,
    executor?: Pool | PoolClient,
  ): Promise<LeaveRequest[]> {
    const exe = executor || this.pool;
    const result = await exe.query(
      `${SELECT_WITH_JOINS}
       WHERE lr.organization_id = $1 AND lr.approver_id = $2 AND lr.status = 'submitted'
       ORDER BY lr.start_date`,
      [tenantContext.organizationId, approverId],
    );
    return result.rows.map(toModel);
  }

  /** Overlapping live requests for one employee — used for the double-book check. */
  async findOverlapping(
    tenantContext: TenantContext,
    employeeId: string,
    startDate: string,
    endDate: string,
    excludeId?: string,
    executor?: Pool | PoolClient,
  ): Promise<LeaveRequest[]> {
    const exe = executor || this.pool;
    const params: any[] = [
      tenantContext.organizationId,
      employeeId,
      startDate,
      endDate,
    ];
    let query = `
      SELECT * FROM leave_requests
      WHERE organization_id = $1 AND employee_id = $2
        AND status IN ('submitted', 'approved')
        AND NOT (end_date < $3 OR start_date > $4)
    `;
    if (excludeId) {
      query += ` AND id <> $${params.length + 1}`;
      params.push(excludeId);
    }
    const result = await exe.query(query, params);
    return result.rows.map(toModel);
  }

  /** Approved leave across the org overlapping a date window (calendar / "on leave today"). */
  async findCalendar(
    tenantContext: TenantContext,
    from: string,
    to: string,
    executor?: Pool | PoolClient,
  ): Promise<LeaveRequest[]> {
    const exe = executor || this.pool;
    const result = await exe.query(
      `${SELECT_WITH_JOINS}
       WHERE lr.organization_id = $1
         AND lr.status = 'approved'
         AND NOT (lr.end_date < $2 OR lr.start_date > $3)
       ORDER BY lr.start_date`,
      [tenantContext.organizationId, from, to],
    );
    return result.rows.map(toModel);
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
    if (data.cancelled_at !== undefined) fields.push(`cancelled_at = $${paramIndex++}`), values.push(data.cancelled_at);

    fields.push(`updated_at = now()`);

    const query = `
      UPDATE leave_requests
      SET ${fields.join(', ')}
      WHERE organization_id = $1 AND id = $2
      RETURNING id
    `;
    await exe.query(query, values);
    // Re-read through the join view so the response carries display fields.
    return (await this.findById(tenantContext, id, exe)) as LeaveRequest;
  }
}
