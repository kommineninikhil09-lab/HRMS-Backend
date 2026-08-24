import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';

export interface SalarySlip {
  id: string;
  organization_id: string;
  employee_id: string;
  pay_cycle_id: string;
  month: string;
  gross_amount: number;
  total_deductions: number;
  net_amount: number;
  status: 'draft' | 'approved' | 'paid' | 'cancelled';
  generated_at: Date;
  approved_by?: string;
  approved_at?: Date;
  paid_at?: Date;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class SalarySlipRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(
    tenantContext: TenantContext,
    data: Omit<SalarySlip, 'id' | 'created_at' | 'updated_at' | 'generated_at'>,
    executor?: Pool | PoolClient,
  ): Promise<SalarySlip> {
    const sql = `
      INSERT INTO salary_slips (
        organization_id, employee_id, pay_cycle_id, month,
        gross_amount, total_deductions, net_amount, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await this.query<SalarySlip>(
      sql,
      [
        tenantContext.organizationId,
        data.employee_id,
        data.pay_cycle_id,
        data.month,
        data.gross_amount,
        data.total_deductions,
        data.net_amount,
        data.status || 'draft',
      ],
      executor,
    );
    return result.rows[0];
  }

  async findById(
    tenantContext: TenantContext,
    id: string,
    executor?: Pool | PoolClient,
  ): Promise<SalarySlip | null> {
    return this.queryOne<SalarySlip>(
      'SELECT * FROM salary_slips WHERE id = $1 AND organization_id = $2',
      [id, tenantContext.organizationId],
      executor,
    );
  }

  async findByEmployeeAndMonth(
    tenantContext: TenantContext,
    employeeId: string,
    month: string,
    executor?: Pool | PoolClient,
  ): Promise<SalarySlip | null> {
    return this.queryOne<SalarySlip>(
      'SELECT * FROM salary_slips WHERE organization_id = $1 AND employee_id = $2 AND month = $3',
      [tenantContext.organizationId, employeeId, month],
      executor,
    );
  }

  async findByEmployeeAndYear(
    tenantContext: TenantContext,
    employeeId: string,
    year: string,
    executor?: Pool | PoolClient,
  ): Promise<SalarySlip[]> {
    const result = await this.query<SalarySlip>(
      'SELECT * FROM salary_slips WHERE organization_id = $1 AND employee_id = $2 AND month LIKE $3 ORDER BY month DESC',
      [tenantContext.organizationId, employeeId, `${year}-%`],
      executor,
    );
    return result.rows;
  }

  async findByStatus(
    tenantContext: TenantContext,
    status: string,
    executor?: Pool | PoolClient,
  ): Promise<SalarySlip[]> {
    const result = await this.query<SalarySlip>(
      'SELECT * FROM salary_slips WHERE organization_id = $1 AND status = $2 ORDER BY month DESC',
      [tenantContext.organizationId, status],
      executor,
    );
    return result.rows;
  }

  async update(
    tenantContext: TenantContext,
    id: string,
    data: Partial<SalarySlip>,
    executor?: Pool | PoolClient,
  ): Promise<SalarySlip> {
    const fields: string[] = [];
    const values: any[] = [tenantContext.organizationId, id];
    let paramCount = 3;

    if (data.status) {
      fields.push(`status = $${paramCount++}`);
      values.push(data.status);
    }
    if (data.approved_by) {
      fields.push(`approved_by = $${paramCount++}`);
      values.push(data.approved_by);
    }
    if (data.approved_at) {
      fields.push(`approved_at = $${paramCount++}`);
      values.push(data.approved_at);
    }
    if (data.paid_at) {
      fields.push(`paid_at = $${paramCount++}`);
      values.push(data.paid_at);
    }

    fields.push('updated_at = now()');

    const sql = `
      UPDATE salary_slips
      SET ${fields.join(', ')}
      WHERE id = $2 AND organization_id = $1
      RETURNING *
    `;
    const result = await this.query<SalarySlip>(sql, values, executor);
    return result.rows[0];
  }
}
