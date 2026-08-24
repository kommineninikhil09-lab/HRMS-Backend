import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';

export interface StructureComponent {
  id: string;
  organization_id: string;
  structure_id: string;
  component_id: string;
  amount: number;
  percentage?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface StructureComponentWithDetails extends StructureComponent {
  component_name?: string;
  component_type?: string;
  component_code?: string;
}

@Injectable()
export class StructureComponentRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async findByStructure(
    tenantContext: TenantContext,
    structureId: string,
    executor?: Pool | PoolClient,
  ): Promise<StructureComponentWithDetails[]> {
    const sql = `
      SELECT
        sc.*,
        c.name as component_name,
        c.code as component_code,
        c.component_type
      FROM structure_components sc
      JOIN salary_components c ON sc.component_id = c.id
      WHERE sc.organization_id = $1
        AND sc.structure_id = $2
        AND sc.is_active = true
      ORDER BY c.component_type, c.name
    `;
    const result = await this.query<StructureComponentWithDetails>(
      sql,
      [tenantContext.organizationId, structureId],
      executor,
    );
    return result.rows;
  }

  async addComponentToStructure(
    tenantContext: TenantContext,
    structureId: string,
    componentId: string,
    amount: number,
    percentage?: number,
    executor?: Pool | PoolClient,
  ): Promise<StructureComponent> {
    const sql = `
      INSERT INTO structure_components (
        organization_id, structure_id, component_id, amount, percentage, is_active
      )
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (structure_id, component_id)
      DO UPDATE SET amount = $4, percentage = $5, updated_at = now()
      RETURNING *
    `;
    const result = await this.query<StructureComponent>(
      sql,
      [tenantContext.organizationId, structureId, componentId, amount, percentage || null],
      executor,
    );
    return result.rows[0];
  }

  async removeComponentFromStructure(
    tenantContext: TenantContext,
    structureId: string,
    componentId: string,
    executor?: Pool | PoolClient,
  ): Promise<void> {
    const sql = `
      DELETE FROM structure_components
      WHERE organization_id = $1 AND structure_id = $2 AND component_id = $3
    `;
    await this.query(
      sql,
      [tenantContext.organizationId, structureId, componentId],
      executor,
    );
  }
}
