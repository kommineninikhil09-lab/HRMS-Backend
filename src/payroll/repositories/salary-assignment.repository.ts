import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';

export interface SalaryAssignment {
  id: string;
  organization_id: string;
  employee_id: string;
  structure_id: string;
  effective_date: Date;
  end_date?: Date;
  status: 'active' | 'inactive' | 'superseded';
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class SalaryAssignmentRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(
    tenantContext: TenantContext,
    data: Omit<SalaryAssignment, 'id' | 'created_at' | 'updated_at'>,
    executor?: Pool | PoolClient,
  ): Promise<SalaryAssignment> {
    const sql = `
      INSERT INTO salary_assignments (
        organization_id, employee_id, structure_id, effective_date, end_date, status
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await this.query<SalaryAssignment>(
      sql,
      [
        tenantContext.organizationId,
        data.employee_id,
        data.structure_id,
        data.effective_date,
        data.end_date || null,
        data.status || 'active',
      ],
      executor,
    );
    return result.rows[0];
  }

  async findActiveByEmployee(
    tenantContext: TenantContext,
    employeeId: string,
    asOfDate?: Date,
    executor?: Pool | PoolClient,
  ): Promise<SalaryAssignment | null> {
    const checkDate = asOfDate || new Date();
    const sql = `
      SELECT * FROM salary_assignments
      WHERE organization_id = $1
        AND employee_id = $2
        AND status = 'active'
        AND effective_date <= $3
        AND (end_date IS NULL OR end_date > $3)
      ORDER BY effective_date DESC
      LIMIT 1
    `;
    return this.queryOne<SalaryAssignment>(
      sql,
      [tenantContext.organizationId, employeeId, checkDate],
      executor,
    );
  }

  async findByEmployee(
    tenantContext: TenantContext,
    employeeId: string,
    executor?: Pool | PoolClient,
  ): Promise<SalaryAssignment[]> {
    const sql = `
      SELECT * FROM salary_assignments
      WHERE organization_id = $1 AND employee_id = $2
      ORDER BY effective_date DESC
    `;
    const result = await this.query<SalaryAssignment>(
      sql,
      [tenantContext.organizationId, employeeId],
      executor,
    );
    return result.rows;
  }

  async update(
    tenantContext: TenantContext,
    id: string,
    data: Partial<SalaryAssignment>,
    executor?: Pool | PoolClient,
  ): Promise<SalaryAssignment> {
    const fields: string[] = [];
    const values: any[] = [tenantContext.organizationId, id];
    let paramCount = 3;

    if (data.status) {
      fields.push(`status = $${paramCount++}`);
      values.push(data.status);
    }
    if (data.end_date !== undefined) {
      fields.push(`end_date = $${paramCount++}`);
      values.push(data.end_date);
    }

    fields.push('updated_at = now()');

    const sql = `
      UPDATE salary_assignments
      SET ${fields.join(', ')}
      WHERE id = $2 AND organization_id = $1
      RETURNING *
    `;
    const result = await this.query<SalaryAssignment>(sql, values, executor);
    return result.rows[0];
  }
}
