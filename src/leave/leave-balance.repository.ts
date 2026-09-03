import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { TenantContext } from '../database/tenant-context';
import { Pool, PoolClient } from 'pg';

export interface LeaveBalance {
  id: string;
  organization_id: string;
  employee_id: string;
  leave_type_id: string;
  financial_year: string;
  opening_balance: number;
  allocated: number;
  used: number;
  pending: number;
  carry_forward: number;
  lapsed: number;
  created_at: string;
  updated_at: string;
}

/** NUMERIC columns arrive from node-pg as strings; coerce to numbers. */
function toModel(row: any): LeaveBalance {
  if (!row) return row;
  return {
    ...row,
    opening_balance: Number(row.opening_balance),
    allocated: Number(row.allocated),
    used: Number(row.used),
    pending: Number(row.pending),
    carry_forward: Number(row.carry_forward),
    lapsed: Number(row.lapsed),
  };
}

@Injectable()
export class LeaveBalanceRepository extends BaseRepository {
  async create(
    tenantContext: TenantContext,
    data: Partial<LeaveBalance>,
    executor?: Pool | PoolClient,
  ): Promise<LeaveBalance> {
    const exe = executor || this.pool;
    const query = `
      INSERT INTO leave_balance (organization_id, employee_id, leave_type_id, financial_year, opening_balance, allocated, used, pending, carry_forward, lapsed)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const result = await exe.query(query, [
      tenantContext.organizationId,
      data.employee_id,
      data.leave_type_id,
      data.financial_year,
      data.opening_balance || 0,
      data.allocated || 0,
      data.used || 0,
      data.pending || 0,
      data.carry_forward || 0,
      data.lapsed || 0,
    ]);
    return toModel(result.rows[0]);
  }

  async findByEmployeeAndType(
    tenantContext: TenantContext,
    employeeId: string,
    leaveTypeId: string,
    financialYear: string,
    executor?: Pool | PoolClient,
  ): Promise<LeaveBalance | null> {
    const exe = executor || this.pool;
    const query = `
      SELECT * FROM leave_balance
      WHERE organization_id = $1 AND employee_id = $2 AND leave_type_id = $3 AND financial_year = $4
    `;
    const result = await exe.query(query, [
      tenantContext.organizationId,
      employeeId,
      leaveTypeId,
      financialYear,
    ]);
    return result.rows[0] ? toModel(result.rows[0]) : null;
  }

  async findByEmployee(
    tenantContext: TenantContext,
    employeeId: string,
    financialYear: string,
    executor?: Pool | PoolClient,
  ): Promise<LeaveBalance[]> {
    const exe = executor || this.pool;
    const query = `
      SELECT * FROM leave_balance
      WHERE organization_id = $1 AND employee_id = $2 AND financial_year = $3
      ORDER BY created_at
    `;
    const result = await exe.query(query, [
      tenantContext.organizationId,
      employeeId,
      financialYear,
    ]);
    return result.rows.map(toModel);
  }

  async updateBalance(
    tenantContext: TenantContext,
    balanceId: string,
    data: Partial<LeaveBalance>,
    executor?: Pool | PoolClient,
  ): Promise<LeaveBalance> {
    const exe = executor || this.pool;
    const fields: string[] = [];
    const values: any[] = [tenantContext.organizationId, balanceId];
    let paramIndex = 3;

    if (data.used !== undefined) fields.push(`used = $${paramIndex++}`), values.push(data.used);
    if (data.pending !== undefined) fields.push(`pending = $${paramIndex++}`), values.push(data.pending);
    if (data.allocated !== undefined) fields.push(`allocated = $${paramIndex++}`), values.push(data.allocated);
    if (data.carry_forward !== undefined) fields.push(`carry_forward = $${paramIndex++}`), values.push(data.carry_forward);
    if (data.lapsed !== undefined) fields.push(`lapsed = $${paramIndex++}`), values.push(data.lapsed);

    fields.push(`updated_at = now()`);

    const query = `
      UPDATE leave_balance
      SET ${fields.join(', ')}
      WHERE organization_id = $1 AND id = $2
      RETURNING *
    `;
    const result = await exe.query(query, values);
    return toModel(result.rows[0]);
  }

  async getAvailableBalance(
    tenantContext: TenantContext,
    employeeId: string,
    leaveTypeId: string,
    financialYear: string,
    executor?: Pool | PoolClient,
  ): Promise<number> {
    const balance = await this.findByEmployeeAndType(
      tenantContext,
      employeeId,
      leaveTypeId,
      financialYear,
      executor,
    );

    if (!balance) return 0;

    return (
      balance.opening_balance +
      balance.allocated +
      balance.carry_forward -
      balance.used -
      balance.pending
    );
  }
}
