import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class AppraisalTemplateRepository extends BaseRepository {
  async create(
    tenantContext: TenantContext,
    data: any,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      INSERT INTO appraisal_templates
      (organization_id, name, description, template_type, rating_scale, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, now(), now())
      RETURNING *;
    `;

    return this.queryOne<any>(
      sql,
      [
        tenantContext.organizationId,
        data.name,
        data.description,
        data.template_type,
        data.rating_scale || '1-5',
        data.is_active !== false,
      ],
      executor,
    );
  }

  async findById(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const sql = `
      SELECT * FROM appraisal_templates
      WHERE id = $1 AND organization_id = $2;
    `;

    return this.queryOne<any>(sql, [id, tenantContext.organizationId], executor);
  }

  async findAll(tenantContext: TenantContext, executor?: Pool | PoolClient) {
    const sql = `
      SELECT * FROM appraisal_templates
      WHERE organization_id = $1 AND is_active = true
      ORDER BY name;
    `;

    return this.query<any>(sql, [tenantContext.organizationId], executor);
  }

  async findByType(
    tenantContext: TenantContext,
    templateType: string,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      SELECT * FROM appraisal_templates
      WHERE organization_id = $1 AND template_type = $2 AND is_active = true
      ORDER BY name;
    `;

    return this.query<any>(sql, [tenantContext.organizationId, templateType], executor);
  }

  async update(
    tenantContext: TenantContext,
    id: string,
    data: any,
    executor?: Pool | PoolClient,
  ) {
    const updates: string[] = [];
    const values: any[] = [tenantContext.organizationId, id];
    let paramCount = 2;

    if (data.name) {
      updates.push(`name = $${++paramCount}`);
      values.push(data.name);
    }
    if (data.description) {
      updates.push(`description = $${++paramCount}`);
      values.push(data.description);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${++paramCount}`);
      values.push(data.is_active);
    }

    updates.push(`updated_at = now()`);

    const sql = `
      UPDATE appraisal_templates
      SET ${updates.join(', ')}
      WHERE id = $2 AND organization_id = $1
      RETURNING *;
    `;

    return this.queryOne<any>(sql, values, executor);
  }
}
