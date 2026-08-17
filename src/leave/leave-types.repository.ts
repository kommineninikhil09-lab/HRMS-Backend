import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { TenantContext } from '../database/tenant-context';
import { Pool, PoolClient } from 'pg';

export interface LeaveType {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  annual_allocation: number;
  carry_forward_limit: number;
  requires_approval: boolean;
  is_paid: boolean;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class LeaveTypesRepository extends BaseRepository {
  async create(
    tenantContext: TenantContext,
    data: Partial<LeaveType>,
    executor?: Pool | PoolClient,
  ): Promise<LeaveType> {
    const exe = executor || this.pool;
    const query = `
      INSERT INTO leave_types (organization_id, name, code, annual_allocation, carry_forward_limit, requires_approval, is_paid, description, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await exe.query(query, [
      tenantContext.organizationId,
      data.name,
      data.code,
      data.annual_allocation || 0,
      data.carry_forward_limit || 0,
      data.requires_approval !== false,
      data.is_paid !== false,
      data.description || null,
      data.status || 'active',
    ]);
    return result.rows[0];
  }

  async findById(
    tenantContext: TenantContext,
    id: string,
    executor?: Pool | PoolClient,
  ): Promise<LeaveType | null> {
    const exe = executor || this.pool;
    const query = `SELECT * FROM leave_types WHERE organization_id = $1 AND id = $2`;
    const result = await exe.query(query, [tenantContext.organizationId, id]);
    return result.rows[0] || null;
  }

  async findByCode(
    tenantContext: TenantContext,
    code: string,
    executor?: Pool | PoolClient,
  ): Promise<LeaveType | null> {
    const exe = executor || this.pool;
    const query = `SELECT * FROM leave_types WHERE organization_id = $1 AND code = $2`;
    const result = await exe.query(query, [tenantContext.organizationId, code]);
    return result.rows[0] || null;
  }

  async findAll(
    tenantContext: TenantContext,
    filters?: { status?: string },
    executor?: Pool | PoolClient,
  ): Promise<LeaveType[]> {
    const exe = executor || this.pool;
    let query = `SELECT * FROM leave_types WHERE organization_id = $1`;
    const params: any[] = [tenantContext.organizationId];

    if (filters?.status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }

    query += ` ORDER BY name`;
    const result = await exe.query(query, params);
    return result.rows;
  }

  async update(
    tenantContext: TenantContext,
    id: string,
    data: Partial<LeaveType>,
    executor?: Pool | PoolClient,
  ): Promise<LeaveType> {
    const exe = executor || this.pool;
    const fields: string[] = [];
    const values: any[] = [tenantContext.organizationId, id];
    let paramIndex = 3;

    if (data.name !== undefined) fields.push(`name = $${paramIndex++}`), values.push(data.name);
    if (data.code !== undefined) fields.push(`code = $${paramIndex++}`), values.push(data.code);
    if (data.annual_allocation !== undefined) fields.push(`annual_allocation = $${paramIndex++}`), values.push(data.annual_allocation);
    if (data.carry_forward_limit !== undefined) fields.push(`carry_forward_limit = $${paramIndex++}`), values.push(data.carry_forward_limit);
    if (data.requires_approval !== undefined) fields.push(`requires_approval = $${paramIndex++}`), values.push(data.requires_approval);
    if (data.is_paid !== undefined) fields.push(`is_paid = $${paramIndex++}`), values.push(data.is_paid);
    if (data.description !== undefined) fields.push(`description = $${paramIndex++}`), values.push(data.description);
    if (data.status !== undefined) fields.push(`status = $${paramIndex++}`), values.push(data.status);

    fields.push(`updated_at = now()`);

    const query = `
      UPDATE leave_types
      SET ${fields.join(', ')}
      WHERE organization_id = $1 AND id = $2
      RETURNING *
    `;
    const result = await exe.query(query, values);
    return result.rows[0];
  }

  async delete(
    tenantContext: TenantContext,
    id: string,
    executor?: Pool | PoolClient,
  ): Promise<void> {
    const exe = executor || this.pool;
    const query = `DELETE FROM leave_types WHERE organization_id = $1 AND id = $2`;
    await exe.query(query, [tenantContext.organizationId, id]);
  }
}
