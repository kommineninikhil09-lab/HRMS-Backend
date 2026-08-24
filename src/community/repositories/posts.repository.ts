import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';
import { Pool, PoolClient } from 'pg';

export interface Post {
  id: string;
  organization_id: string;
  user_id: string;
  content: string;
  category: string; // general, announcement, celebration
  status: string; // published, draft, archived
  likes_count: number;
  comments_count: number;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  created_by?: string;
  updated_by?: string;
}

export interface CreatePostDto {
  content: string;
  category?: string;
  status?: string;
}

@Injectable()
export class PostsRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(tenantContext: TenantContext, data: CreatePostDto, executor?: Pool | PoolClient) {
    const query = `
      INSERT INTO posts (organization_id, user_id, content, category, status, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      tenantContext.organizationId,
      tenantContext.userId,
      data.content,
      data.category || 'general',
      data.status || 'published',
      tenantContext.userId,
      tenantContext.userId,
    ];
    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as Post;
  }

  async findById(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM posts
      WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
    `;
    const result = await (executor || this.pool).query(query, [id, tenantContext.organizationId]);
    return result.rows[0] as Post | undefined;
  }

  async findByOrganization(tenantContext: TenantContext, limit = 20, offset = 0, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM posts
      WHERE organization_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await (executor || this.pool).query(query, [tenantContext.organizationId, limit, offset]);
    return result.rows as Post[];
  }

  async findByUser(tenantContext: TenantContext, userId: string, limit = 20, offset = 0, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM posts
      WHERE organization_id = $1 AND user_id = $2 AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const result = await (executor || this.pool).query(query, [tenantContext.organizationId, userId, limit, offset]);
    return result.rows as Post[];
  }

  async update(tenantContext: TenantContext, id: string, data: Partial<CreatePostDto>, executor?: Pool | PoolClient) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      values.push(data.content);
    }
    if (data.category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(data.category);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(data.status);
    }

    updates.push(`updated_at = now(), updated_by = $${paramCount++}`);
    values.push(tenantContext.userId);
    values.push(id);
    values.push(tenantContext.organizationId);

    const query = `
      UPDATE posts
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND organization_id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as Post | undefined;
  }

  async delete(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE posts
      SET deleted_at = now(), updated_at = now(), updated_by = $1
      WHERE id = $2 AND organization_id = $3 AND deleted_at IS NULL
      RETURNING *
    `;
    const result = await (executor || this.pool).query(query, [tenantContext.userId, id, tenantContext.organizationId]);
    return result.rows[0] as Post | undefined;
  }

  async incrementLikesCount(id: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE posts
      SET likes_count = likes_count + 1, updated_at = now()
      WHERE id = $1
      RETURNING likes_count
    `;
    const result = await (executor || this.pool).query(query, [id]);
    return result.rows[0]?.likes_count;
  }

  async decrementLikesCount(id: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE posts
      SET likes_count = GREATEST(0, likes_count - 1), updated_at = now()
      WHERE id = $1
      RETURNING likes_count
    `;
    const result = await (executor || this.pool).query(query, [id]);
    return result.rows[0]?.likes_count;
  }

  async incrementCommentsCount(id: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE posts
      SET comments_count = comments_count + 1, updated_at = now()
      WHERE id = $1
      RETURNING comments_count
    `;
    const result = await (executor || this.pool).query(query, [id]);
    return result.rows[0]?.comments_count;
  }

  async decrementCommentsCount(id: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE posts
      SET comments_count = GREATEST(0, comments_count - 1), updated_at = now()
      WHERE id = $1
      RETURNING comments_count
    `;
    const result = await (executor || this.pool).query(query, [id]);
    return result.rows[0]?.comments_count;
  }
}
