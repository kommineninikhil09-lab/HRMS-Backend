import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';
import { Pool, PoolClient } from 'pg';

export interface Comment {
  id: string;
  organization_id: string;
  user_id: string;
  content: string;
  commentable_type: string; // post, praise
  commentable_id: string;
  status: string; // published, pending, archived
  likes_count: number;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  created_by?: string;
  updated_by?: string;
}

export interface CreateCommentDto {
  content: string;
  commentable_type: string;
  commentable_id: string;
}

@Injectable()
export class CommentsRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(tenantContext: TenantContext, data: CreateCommentDto, executor?: Pool | PoolClient) {
    const query = `
      INSERT INTO comments (organization_id, user_id, content, commentable_type, commentable_id, status, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      tenantContext.organizationId,
      tenantContext.userId,
      data.content,
      data.commentable_type,
      data.commentable_id,
      'published',
      tenantContext.userId,
      tenantContext.userId,
    ];
    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as Comment;
  }

  async findById(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM comments
      WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
    `;
    const result = await (executor || this.pool).query(query, [id, tenantContext.organizationId]);
    return result.rows[0] as Comment | undefined;
  }

  async findByCommentable(tenantContext: TenantContext, commentableType: string, commentableId: string, limit = 20, offset = 0, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM comments
      WHERE organization_id = $1 AND commentable_type = $2 AND commentable_id = $3 AND deleted_at IS NULL
      ORDER BY created_at ASC
      LIMIT $4 OFFSET $5
    `;
    const result = await (executor || this.pool).query(query, [tenantContext.organizationId, commentableType, commentableId, limit, offset]);
    return result.rows as Comment[];
  }

  async findByUser(tenantContext: TenantContext, userId: string, limit = 20, offset = 0, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM comments
      WHERE organization_id = $1 AND user_id = $2 AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const result = await (executor || this.pool).query(query, [tenantContext.organizationId, userId, limit, offset]);
    return result.rows as Comment[];
  }

  async update(tenantContext: TenantContext, id: string, data: Partial<CreateCommentDto>, executor?: Pool | PoolClient) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      values.push(data.content);
    }

    updates.push(`updated_at = now(), updated_by = $${paramCount++}`);
    values.push(tenantContext.userId);
    values.push(id);
    values.push(tenantContext.organizationId);

    const query = `
      UPDATE comments
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND organization_id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as Comment | undefined;
  }

  async delete(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE comments
      SET deleted_at = now(), updated_at = now(), updated_by = $1
      WHERE id = $2 AND organization_id = $3 AND deleted_at IS NULL
      RETURNING *
    `;
    const result = await (executor || this.pool).query(query, [tenantContext.userId, id, tenantContext.organizationId]);
    return result.rows[0] as Comment | undefined;
  }

  async incrementLikesCount(id: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE comments
      SET likes_count = likes_count + 1, updated_at = now()
      WHERE id = $1
      RETURNING likes_count
    `;
    const result = await (executor || this.pool).query(query, [id]);
    return result.rows[0]?.likes_count;
  }

  async decrementLikesCount(id: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE comments
      SET likes_count = GREATEST(0, likes_count - 1), updated_at = now()
      WHERE id = $1
      RETURNING likes_count
    `;
    const result = await (executor || this.pool).query(query, [id]);
    return result.rows[0]?.likes_count;
  }

  async countByCommentable(commentableType: string, commentableId: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT COUNT(*) as count FROM comments
      WHERE commentable_type = $1 AND commentable_id = $2 AND deleted_at IS NULL
    `;
    const result = await (executor || this.pool).query(query, [commentableType, commentableId]);
    return parseInt(result.rows[0]?.count || 0);
  }
}
