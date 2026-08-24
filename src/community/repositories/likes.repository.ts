import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';
import { Pool, PoolClient } from 'pg';

export interface Like {
  id: string;
  user_id: string;
  likeable_type: string; // post, praise, comment
  likeable_id: string;
  created_at: Date;
}

export interface CreateLikeDto {
  likeable_type: string;
  likeable_id: string;
}

@Injectable()
export class LikesRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(tenantContext: TenantContext, data: CreateLikeDto, executor?: Pool | PoolClient) {
    const query = `
      INSERT INTO likes (user_id, likeable_type, likeable_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const values = [tenantContext.userId, data.likeable_type, data.likeable_id];

    try {
      const result = await (executor || this.pool).query(query, values);
      return result.rows[0] as Like;
    } catch (err: any) {
      if (err.code === '23505') {
        return null;
      }
      throw err;
    }
  }

  async findByLikeable(likeable_type: string, likeable_id: string, limit = 100, offset = 0, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM likes
      WHERE likeable_type = $1 AND likeable_id = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const result = await (executor || this.pool).query(query, [likeable_type, likeable_id, limit, offset]);
    return result.rows as Like[];
  }

  async findUserLike(tenantContext: TenantContext, likeable_type: string, likeable_id: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM likes
      WHERE user_id = $1 AND likeable_type = $2 AND likeable_id = $3
    `;
    const result = await (executor || this.pool).query(query, [tenantContext.userId, likeable_type, likeable_id]);
    return result.rows[0] as Like | undefined;
  }

  async delete(likeId: string, executor?: Pool | PoolClient) {
    const query = `DELETE FROM likes WHERE id = $1`;
    await (executor || this.pool).query(query, [likeId]);
  }

  async deleteByUserAndLikeable(tenantContext: TenantContext, likeable_type: string, likeable_id: string, executor?: Pool | PoolClient) {
    const query = `
      DELETE FROM likes
      WHERE user_id = $1 AND likeable_type = $2 AND likeable_id = $3
    `;
    await (executor || this.pool).query(query, [tenantContext.userId, likeable_type, likeable_id]);
  }

  async countByLikeable(likeable_type: string, likeable_id: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT COUNT(*) as count FROM likes
      WHERE likeable_type = $1 AND likeable_id = $2
    `;
    const result = await (executor || this.pool).query(query, [likeable_type, likeable_id]);
    return parseInt(result.rows[0]?.count || 0);
  }
}
