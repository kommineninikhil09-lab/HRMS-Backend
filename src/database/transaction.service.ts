import { Injectable, Inject } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { POOL_PROVIDER } from './pool.provider';

@Injectable()
export class TransactionService {
  constructor(@Inject(POOL_PROVIDER) private pool: Pool) {}

  async runInTransaction<T>(
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
