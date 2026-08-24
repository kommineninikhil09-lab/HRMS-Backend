import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';

export interface SlipComponent {
  id: string;
  organization_id: string;
  slip_id: string;
  component_id: string;
  component_name: string;
  component_type: 'earnings' | 'deduction' | 'tax';
  amount: number;
  created_at: Date;
}

@Injectable()
export class SlipComponentRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async addComponentToSlip(
    tenantContext: TenantContext,
    slipId: string,
    componentId: string,
    componentName: string,
    componentType: 'earnings' | 'deduction' | 'tax',
    amount: number,
    executor?: Pool | PoolClient,
  ): Promise<SlipComponent> {
    const sql = `
      INSERT INTO slip_components (
        organization_id, slip_id, component_id, component_name, component_type, amount
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await this.query<SlipComponent>(
      sql,
      [tenantContext.organizationId, slipId, componentId, componentName, componentType, amount],
      executor,
    );
    return result.rows[0];
  }

  async getSlipBreakdown(
    tenantContext: TenantContext,
    slipId: string,
    executor?: Pool | PoolClient,
  ): Promise<SlipComponent[]> {
    const sql = `
      SELECT * FROM slip_components
      WHERE organization_id = $1 AND slip_id = $2
      ORDER BY component_type, component_name
    `;
    const result = await this.query<SlipComponent>(
      sql,
      [tenantContext.organizationId, slipId],
      executor,
    );
    return result.rows;
  }

  async deleteSlipComponents(
    tenantContext: TenantContext,
    slipId: string,
    executor?: Pool | PoolClient,
  ): Promise<void> {
    const sql = 'DELETE FROM slip_components WHERE organization_id = $1 AND slip_id = $2';
    await this.query(sql, [tenantContext.organizationId, slipId], executor);
  }
}
