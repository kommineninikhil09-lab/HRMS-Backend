import { Injectable, Inject } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { POOL_PROVIDER } from '../database/pool.provider';
import { TenantContext } from '../database/tenant-context';
import { toIsoDate } from '../common/util/date.util';

export interface AttendanceRecord {
  id: string;
  organization_id: string;
  employee_id: string;
  attendance_date: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  working_minutes: number | null;
  late_minutes: number | null;
  early_leave_minutes: number | null;
  status: string;
  source: string;
  notes: string | null;
  marked_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined display fields (present on admin list reads).
  employee_name?: string | null;
  employee_code?: string | null;
}

type NumCol =
  | 'working_minutes'
  | 'late_minutes'
  | 'early_leave_minutes';

/** DATE column → `YYYY-MM-DD`; NUMERIC/int columns → number | null. */
function toModel(row: any): AttendanceRecord {
  if (!row) return row;
  const out = { ...row, attendance_date: toIsoDate(row.attendance_date) };
  for (const col of ['working_minutes', 'late_minutes', 'early_leave_minutes'] as NumCol[]) {
    out[col] = row[col] == null ? null : Number(row[col]);
  }
  return out;
}

const SELECT_WITH_EMPLOYEE = `
  SELECT
    a.*,
    NULLIF(TRIM(COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, '')), '') AS employee_name,
    e.employee_code AS employee_code
  FROM attendance a
  JOIN employees e ON e.id = a.employee_id
`;

@Injectable()
export class AttendanceRepository {
  constructor(@Inject(POOL_PROVIDER) private pool: Pool) {}

  async create(
    tenantContext: TenantContext,
    data: Partial<AttendanceRecord>,
    executor?: Pool | PoolClient,
  ): Promise<AttendanceRecord> {
    const exe = executor || this.pool;
    const result = await exe.query(
      `
      INSERT INTO attendance (
        organization_id, employee_id, attendance_date,
        clock_in_time, clock_out_time, working_minutes,
        late_minutes, early_leave_minutes,
        status, source, notes, marked_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
      `,
      [
        tenantContext.organizationId,
        data.employee_id,
        data.attendance_date,
        data.clock_in_time ?? null,
        data.clock_out_time ?? null,
        data.working_minutes ?? null,
        data.late_minutes ?? null,
        data.early_leave_minutes ?? null,
        data.status ?? 'absent',
        data.source ?? 'web',
        data.notes ?? null,
        data.marked_by ?? null,
      ],
    );
    return toModel(result.rows[0]);
  }

  async findByDate(
    tenantContext: TenantContext,
    employeeId: string,
    date: string,
    executor?: Pool | PoolClient,
  ): Promise<AttendanceRecord | null> {
    const exe = executor || this.pool;
    const result = await exe.query(
      `SELECT * FROM attendance
       WHERE organization_id = $1 AND employee_id = $2 AND attendance_date = $3`,
      [tenantContext.organizationId, employeeId, date],
    );
    return result.rows[0] ? toModel(result.rows[0]) : null;
  }

  async findById(
    tenantContext: TenantContext,
    id: string,
    executor?: Pool | PoolClient,
  ): Promise<AttendanceRecord | null> {
    const exe = executor || this.pool;
    const result = await exe.query(
      `${SELECT_WITH_EMPLOYEE} WHERE a.organization_id = $1 AND a.id = $2`,
      [tenantContext.organizationId, id],
    );
    return result.rows[0] ? toModel(result.rows[0]) : null;
  }

  /** One employee's rows in [startDate, endDate], newest first. */
  async findByDateRange(
    tenantContext: TenantContext,
    employeeId: string,
    startDate: string,
    endDate: string,
    executor?: Pool | PoolClient,
  ): Promise<AttendanceRecord[]> {
    const exe = executor || this.pool;
    const result = await exe.query(
      `SELECT * FROM attendance
       WHERE organization_id = $1 AND employee_id = $2
         AND attendance_date BETWEEN $3 AND $4
       ORDER BY attendance_date DESC`,
      [tenantContext.organizationId, employeeId, startDate, endDate],
    );
    return result.rows.map(toModel);
  }

  /** Org-wide list for HR/admin, with optional employee / status / window filters. */
  async findForOrg(
    tenantContext: TenantContext,
    filters: {
      from: string;
      to: string;
      employeeId?: string;
      status?: string;
    },
    executor?: Pool | PoolClient,
  ): Promise<AttendanceRecord[]> {
    const exe = executor || this.pool;
    const params: any[] = [
      tenantContext.organizationId,
      filters.from,
      filters.to,
    ];
    let query = `${SELECT_WITH_EMPLOYEE}
      WHERE a.organization_id = $1
        AND a.attendance_date BETWEEN $2 AND $3`;

    if (filters.employeeId) {
      query += ` AND a.employee_id = $${params.length + 1}`;
      params.push(filters.employeeId);
    }
    if (filters.status) {
      query += ` AND a.status = $${params.length + 1}`;
      params.push(filters.status);
    }

    query += ` ORDER BY a.attendance_date DESC, employee_name ASC`;
    const result = await exe.query(query, params);
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
    let i = 3;

    const set = (col: string, val: any) => {
      fields.push(`${col} = $${i++}`);
      values.push(val);
    };

    if (data.clock_in_time !== undefined) set('clock_in_time', data.clock_in_time);
    if (data.clock_out_time !== undefined) set('clock_out_time', data.clock_out_time);
    if (data.working_minutes !== undefined) set('working_minutes', data.working_minutes);
    if (data.late_minutes !== undefined) set('late_minutes', data.late_minutes);
    if (data.early_leave_minutes !== undefined) set('early_leave_minutes', data.early_leave_minutes);
    if (data.status !== undefined) set('status', data.status);
    if (data.source !== undefined) set('source', data.source);
    if (data.notes !== undefined) set('notes', data.notes);
    if (data.marked_by !== undefined) set('marked_by', data.marked_by);

    fields.push(`updated_at = now()`);

    const result = await exe.query(
      `UPDATE attendance SET ${fields.join(', ')}
       WHERE organization_id = $1 AND id = $2
       RETURNING *`,
      values,
    );
    return toModel(result.rows[0]);
  }

  /** Organisation timezone (IANA name) for deriving the attendance day. */
  async getOrganizationTimezone(
    organizationId: string,
    executor?: Pool | PoolClient,
  ): Promise<string | null> {
    const exe = executor || this.pool;
    const result = await exe.query<{ timezone: string | null }>(
      `SELECT timezone FROM organizations WHERE id = $1`,
      [organizationId],
    );
    return result.rows[0]?.timezone ?? null;
  }
}
