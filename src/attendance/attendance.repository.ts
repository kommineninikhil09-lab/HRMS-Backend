import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { TenantContext } from '../database/tenant-context';
import { toIsoDate } from '../common/util/date.util';
import { Pool, PoolClient } from 'pg';

export interface AttendanceRecord {
  id: string;
  organization_id: string;
  employee_id: string;
  attendance_date: string;
  clock_in_time?: string;
  clock_out_time?: string;
  status: string;
  notes?: string;
  marked_by?: string;
  created_at: string;
  updated_at: string;
}

/** `attendance_date` is a DATE column → normalise to `YYYY-MM-DD`. */
function toModel(row: any): AttendanceRecord {
  if (!row) return row;
  return { ...row, attendance_date: toIsoDate(row.attendance_date) };
}

@Injectable()
export class AttendanceRepository extends BaseRepository {
  async create(
    tenantContext: TenantContext,
    data: Partial<AttendanceRecord>,
    executor?: Pool | PoolClient,
  ): Promise<AttendanceRecord> {
    const exe = executor || this.pool;
    const query = `
      INSERT INTO attendance (organization_id, employee_id, attendance_date, clock_in_time, clock_out_time, status, notes, marked_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await exe.query(query, [
      tenantContext.organizationId,
      data.employee_id,
      data.attendance_date,
      data.clock_in_time || null,
      data.clock_out_time || null,
      data.status || 'absent',
      data.notes || null,
      data.marked_by || null,
    ]);
    return toModel(result.rows[0]);
  }

  async findByDate(
    tenantContext: TenantContext,
    employeeId: string,
    date: string,
    executor?: Pool | PoolClient,
  ): Promise<AttendanceRecord | null> {
    const exe = executor || this.pool;
    const query = `
      SELECT * FROM attendance
      WHERE organization_id = $1 AND employee_id = $2 AND attendance_date = $3
    `;
    const result = await exe.query(query, [tenantContext.organizationId, employeeId, date]);
    return result.rows[0] ? toModel(result.rows[0]) : null;
  }

  async findByDateRange(
    tenantContext: TenantContext,
    employeeId: string,
    startDate: string,
    endDate: string,
    executor?: Pool | PoolClient,
  ): Promise<AttendanceRecord[]> {
    const exe = executor || this.pool;
    const query = `
      SELECT * FROM attendance
      WHERE organization_id = $1 AND employee_id = $2 AND attendance_date BETWEEN $3 AND $4
      ORDER BY attendance_date DESC
    `;
    const result = await exe.query(query, [
      tenantContext.organizationId,
      employeeId,
      startDate,
      endDate,
    ]);
    return result.rows.map(toModel);
  }

  async update(
    tenantContext: TenantContext,
    attendanceId: string,
    data: Partial<AttendanceRecord>,
    executor?: Pool | PoolClient,
  ): Promise<AttendanceRecord> {
    const exe = executor || this.pool;
    const fields: string[] = [];
    const values: any[] = [tenantContext.organizationId, attendanceId];
    let paramIndex = 3;

    if (data.clock_in_time !== undefined) fields.push(`clock_in_time = $${paramIndex++}`), values.push(data.clock_in_time);
    if (data.clock_out_time !== undefined) fields.push(`clock_out_time = $${paramIndex++}`), values.push(data.clock_out_time);
    if (data.status !== undefined) fields.push(`status = $${paramIndex++}`), values.push(data.status);
    if (data.notes !== undefined) fields.push(`notes = $${paramIndex++}`), values.push(data.notes);

    fields.push(`updated_at = now()`);

    const query = `
      UPDATE attendance
      SET ${fields.join(', ')}
      WHERE organization_id = $1 AND id = $2
      RETURNING *
    `;
    const result = await exe.query(query, values);
    return toModel(result.rows[0]);
  }

  async findById(
    tenantContext: TenantContext,
    id: string,
    executor?: Pool | PoolClient,
  ): Promise<AttendanceRecord | null> {
    const exe = executor || this.pool;
    const query = `SELECT * FROM attendance WHERE organization_id = $1 AND id = $2`;
    const result = await exe.query(query, [tenantContext.organizationId, id]);
    return result.rows[0] ? toModel(result.rows[0]) : null;
  }

  async getEmployeeAttendanceSummary(
    tenantContext: TenantContext,
    employeeId: string,
    month: string,
    executor?: Pool | PoolClient,
  ): Promise<any> {
    const exe = executor || this.pool;
    const query = `
      SELECT
        status,
        COUNT(*) as count
      FROM attendance
      WHERE organization_id = $1 AND employee_id = $2 AND TO_CHAR(attendance_date, 'YYYY-MM') = $3
      GROUP BY status
    `;
    const result = await exe.query(query, [tenantContext.organizationId, employeeId, month]);
    return result.rows.map((r: any) => ({ status: r.status, count: Number(r.count) }));
  }
}
