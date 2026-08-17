import { Inject } from '@nestjs/common';
import { Pool, PoolClient, QueryResult } from 'pg';
import { POOL_PROVIDER } from './pool.provider';
import { toCamelCaseRows } from './case-mapper.util';

export abstract class BaseRepository {
  constructor(@Inject(POOL_PROVIDER) protected pool: Pool) {}

  protected buildWhereClause(
    organizationId: string,
    additionalConditions?: Array<{ column: string; operator: string; paramIndex: number }>,
  ): { clause: string; values: (string | any)[] } {
    const values: (string | any)[] = [organizationId];
    let clause = 'organization_id = $1';

    if (additionalConditions && additionalConditions.length > 0) {
      const conditions = additionalConditions
        .map((c) => `${c.column} ${c.operator} $${c.paramIndex}`)
        .join(' AND ');
      clause += ` AND ${conditions}`;
    }

    return { clause, values };
  }

  /**
   * Runs a query and maps result rows from snake_case (Postgres columns) to
   * camelCase (our TypeScript interfaces). All repository reads/writes that
   * return row data should go through this method rather than calling
   * `executor.query()` directly, so the mapping is applied consistently.
   */
  protected async query<T = any>(
    sql: string,
    values: any[] = [],
    executor: Pool | PoolClient = this.pool,
  ): Promise<QueryResult<T>> {
    const result = await executor.query(sql, values);
    return { ...result, rows: toCamelCaseRows<T>(result.rows) };
  }

  protected async queryOne<T = any>(
    sql: string,
    values: any[] = [],
    executor: Pool | PoolClient = this.pool,
  ): Promise<T | null> {
    const result = await this.query<T>(sql, values, executor);
    return result.rows.length > 0 ? result.rows[0] : null;
  }
}
