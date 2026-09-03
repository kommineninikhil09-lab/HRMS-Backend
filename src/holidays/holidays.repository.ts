import { Injectable, Inject } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { POOL_PROVIDER } from '../database/pool.provider';
import { TenantContext } from '../database/tenant-context';
import { toIsoDate } from '../common/util/date.util';

export interface Holiday {
  id: string;
  organization_id: string;
  name: string;
  holiday_date: string;
  is_optional: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/** `holiday_date` is a DATE column → normalise to `YYYY-MM-DD`. */
function toModel(row: any): Holiday {
  if (!row) return row;
  return { ...row, holiday_date: toIsoDate(row.holiday_date) };
}

@Injectable()
export class HolidaysRepository {
  constructor(@Inject(POOL_PROVIDER) private pool: Pool) {}

  async findByOrg(
    tenantContext: TenantContext,
    filters: { from?: string; to?: string } = {},
    executor?: Pool | PoolClient,
  ): Promise<Holiday[]> {
    const exe = executor || this.pool;
    let query = `SELECT * FROM holidays WHERE organization_id = $1`;
    const params: any[] = [tenantContext.organizationId];

    if (filters.from) {
      query += ` AND holiday_date >= $${params.length + 1}`;
      params.push(filters.from);
    }
    if (filters.to) {
      query += ` AND holiday_date <= $${params.length + 1}`;
      params.push(filters.to);
    }

    query += ` ORDER BY holiday_date`;
    const result = await exe.query(query, params);
    return result.rows.map(toModel);
  }

  async findById(
    tenantContext: TenantContext,
    id: string,
    executor?: Pool | PoolClient,
  ): Promise<Holiday | null> {
    const exe = executor || this.pool;
    const result = await exe.query(
      `SELECT * FROM holidays WHERE organization_id = $1 AND id = $2`,
      [tenantContext.organizationId, id],
    );
    return result.rows[0] ? toModel(result.rows[0]) : null;
  }

  async create(
    tenantContext: TenantContext,
    data: {
      name: string;
      holiday_date: string;
      is_optional?: boolean;
      description?: string;
    },
    executor?: Pool | PoolClient,
  ): Promise<Holiday> {
    const exe = executor || this.pool;
    const result = await exe.query(
      `
        INSERT INTO holidays (organization_id, name, holiday_date, is_optional, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [
        tenantContext.organizationId,
        data.name,
        data.holiday_date,
        data.is_optional ?? false,
        data.description ?? null,
      ],
    );
    return toModel(result.rows[0]);
  }

  async delete(
    tenantContext: TenantContext,
    id: string,
    executor?: Pool | PoolClient,
  ): Promise<void> {
    const exe = executor || this.pool;
    await exe.query(
      `DELETE FROM holidays WHERE organization_id = $1 AND id = $2`,
      [tenantContext.organizationId, id],
    );
  }
}
