import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';

export interface SalaryComponent {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  component_type: 'earnings' | 'deduction' | 'tax';
  description?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class SalaryComponentRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(
    tenantContext: TenantContext,
    data: Omit<SalaryComponent, 'id' | 'created_at' | 'updated_at'>,
    executor?: Pool | PoolClient,
  ): Promise<SalaryComponent> {
    const sql = `
      INSERT INTO salary_components (organization_id, name, code, component_type, description, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await this.query<SalaryComponent>(
      sql,
      [
        tenantContext.organizationId,
        data.name,
        data.code,
        data.component_type,
        data.description || null,
        data.is_active ?? true,
      ],
      executor,
    );
    return result.rows[0];
  }

  async findById(
    tenantContext: TenantContext,
    id: string,
    executor?: Pool | PoolClient,
  ): Promise<SalaryComponent | null> {
    return this.queryOne<SalaryComponent>(
      'SELECT * FROM salary_components WHERE id = $1 AND organization_id = $2',
      [id, tenantContext.organizationId],
      executor,
    );
  }

  async findAll(
    tenantContext: TenantContext,
    executor?: Pool | PoolClient,
  ): Promise<SalaryComponent[]> {
    const result = await this.query<SalaryComponent>(
      'SELECT * FROM salary_components WHERE organization_id = $1 ORDER BY name ASC',
      [tenantContext.organizationId],
      executor,
    );
    return result.rows;
  }

  async findByType(
    tenantContext: TenantContext,
    componentType: 'earnings' | 'deduction' | 'tax',
    executor?: Pool | PoolClient,
  ): Promise<SalaryComponent[]> {
    const result = await this.query<SalaryComponent>(
      'SELECT * FROM salary_components WHERE organization_id = $1 AND component_type = $2 ORDER BY name ASC',
      [tenantContext.organizationId, componentType],
      executor,
    );
    return result.rows;
  }
}
