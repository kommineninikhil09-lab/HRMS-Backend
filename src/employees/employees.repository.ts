import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { TenantContext } from '../database/tenant-context';
import { Pool, PoolClient } from 'pg';

export interface Employee {
  id: string;
  organization_id: string;
  user_id?: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  work_email?: string;
  personal_email?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  department_id?: string;
  team_id?: string;
  location_id?: string;
  designation_id?: string;
  grade_id?: string;
  business_unit_id?: string;
  manager_id?: string;
  employment_type?: string;
  date_of_joining: Date;
  date_of_exit?: Date;
  status: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

@Injectable()
export class EmployeesRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(tenantContext: TenantContext, data: Partial<Employee>, executor?: Pool | PoolClient) {
    const query = `
      INSERT INTO employees (
        organization_id, employee_code, first_name, last_name, work_email, personal_email,
        phone, dob, gender, department_id, location_id, designation_id, manager_id,
        employment_type, date_of_joining, status, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;
    const values = [
      tenantContext.organizationId,
      data.employee_code,
      data.first_name,
      data.last_name,
      data.work_email || null,
      data.personal_email || null,
      data.phone || null,
      data.dob || null,
      data.gender || null,
      data.department_id || null,
      data.location_id || null,
      data.designation_id || null,
      data.manager_id || null,
      data.employment_type || null,
      data.date_of_joining,
      data.status || 'active',
      tenantContext.userId,
      tenantContext.userId,
    ];
    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as Employee;
  }

  async findById(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM employees
      WHERE id = $1 AND organization_id = $2
    `;
    const result = await (executor || this.pool).query(query, [id, tenantContext.organizationId]);
    return result.rows[0] as Employee | undefined;
  }

  async findByCode(tenantContext: TenantContext, code: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM employees
      WHERE employee_code = $1 AND organization_id = $2
    `;
    const result = await (executor || this.pool).query(query, [code, tenantContext.organizationId]);
    return result.rows[0] as Employee | undefined;
  }

  async findByEmail(tenantContext: TenantContext, email: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM employees
      WHERE work_email = $1 AND organization_id = $2
    `;
    const result = await (executor || this.pool).query(query, [email, tenantContext.organizationId]);
    return result.rows[0] as Employee | undefined;
  }

  async findByUserId(tenantContext: TenantContext, userId: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM employees
      WHERE user_id = $1 AND organization_id = $2
    `;
    const result = await (executor || this.pool).query(query, [userId, tenantContext.organizationId]);
    return result.rows[0] as Employee | undefined;
  }

  async findAll(tenantContext: TenantContext, filters?: { status?: string; department_id?: string }, executor?: Pool | PoolClient) {
    let query = `SELECT * FROM employees WHERE organization_id = $1`;
    const values: any[] = [tenantContext.organizationId];
    let paramIndex = 2;

    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }
    if (filters?.department_id) {
      query += ` AND department_id = $${paramIndex}`;
      values.push(filters.department_id);
      paramIndex++;
    }

    query += ` ORDER BY first_name, last_name`;
    const result = await (executor || this.pool).query(query, values);
    return result.rows as Employee[];
  }

  async update(tenantContext: TenantContext, id: string, data: Partial<Employee>, executor?: Pool | PoolClient) {
    const updates: string[] = [];
    const values: any[] = [id, tenantContext.organizationId];
    let paramIndex = 3;

    if (data.first_name !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      values.push(data.first_name);
      paramIndex++;
    }
    if (data.last_name !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      values.push(data.last_name);
      paramIndex++;
    }
    if (data.work_email !== undefined) {
      updates.push(`work_email = $${paramIndex}`);
      values.push(data.work_email);
      paramIndex++;
    }
    if (data.phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      values.push(data.phone);
      paramIndex++;
    }
    if (data.department_id !== undefined) {
      updates.push(`department_id = $${paramIndex}`);
      values.push(data.department_id || null);
      paramIndex++;
    }
    if (data.location_id !== undefined) {
      updates.push(`location_id = $${paramIndex}`);
      values.push(data.location_id);
      paramIndex++;
    }
    if (data.designation_id !== undefined) {
      updates.push(`designation_id = $${paramIndex}`);
      values.push(data.designation_id);
      paramIndex++;
    }
    if (data.manager_id !== undefined) {
      updates.push(`manager_id = $${paramIndex}`);
      values.push(data.manager_id || null);
      paramIndex++;
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(data.status);
      paramIndex++;
    }

    updates.push(`updated_by = $${paramIndex}`);
    values.push(tenantContext.userId);
    paramIndex++;

    updates.push(`updated_at = now()`);

    const query = `
      UPDATE employees
      SET ${updates.join(', ')}
      WHERE id = $1 AND organization_id = $2
      RETURNING *
    `;
    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as Employee | undefined;
  }

  async delete(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      DELETE FROM employees
      WHERE id = $1 AND organization_id = $2
    `;
    await (executor || this.pool).query(query, [id, tenantContext.organizationId]);
  }
}
