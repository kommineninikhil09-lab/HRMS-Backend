import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';
import { Pool, PoolClient } from 'pg';

export interface Praise {
  id: string;
  organization_id: string;
  from_user_id: string;
  to_employee_id: string;
  badge_type: string; // top_performer, leadership_impact, customer_hero, above_beyond, team_player, rockstar_rookie, legacy_builder, all_day_everyday
  description: string;
  project_id?: string;
  visibility: string; // public, team, private
  likes_count: number;
  comments_count: number;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface CreatePraiseDto {
  to_employee_id: string;
  badge_type: string;
  description: string;
  project_id?: string;
  visibility?: string;
}

@Injectable()
export class PraiseRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(tenantContext: TenantContext, data: CreatePraiseDto, executor?: Pool | PoolClient) {
    const query = `
      INSERT INTO praise (organization_id, from_user_id, to_employee_id, badge_type, description, project_id, visibility, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const values = [
      tenantContext.organizationId,
      tenantContext.userId,
      data.to_employee_id,
      data.badge_type,
      data.description,
      data.project_id || null,
      data.visibility || 'public',
      tenantContext.userId,
      tenantContext.userId,
    ];
    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as Praise;
  }

  async findById(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM praise
      WHERE id = $1 AND organization_id = $2
    `;
    const result = await (executor || this.pool).query(query, [id, tenantContext.organizationId]);
    return result.rows[0] as Praise | undefined;
  }

  async findByOrganization(tenantContext: TenantContext, limit = 20, offset = 0, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM praise
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await (executor || this.pool).query(query, [tenantContext.organizationId, limit, offset]);
    return result.rows as Praise[];
  }

  async findByToEmployee(tenantContext: TenantContext, employeeId: string, limit = 20, offset = 0, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM praise
      WHERE organization_id = $1 AND to_employee_id = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const result = await (executor || this.pool).query(query, [tenantContext.organizationId, employeeId, limit, offset]);
    return result.rows as Praise[];
  }

  async findByFromUser(tenantContext: TenantContext, userId: string, limit = 20, offset = 0, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM praise
      WHERE organization_id = $1 AND from_user_id = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const result = await (executor || this.pool).query(query, [tenantContext.organizationId, userId, limit, offset]);
    return result.rows as Praise[];
  }

  async findByBadgeType(tenantContext: TenantContext, badgeType: string, limit = 20, offset = 0, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM praise
      WHERE organization_id = $1 AND badge_type = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const result = await (executor || this.pool).query(query, [tenantContext.organizationId, badgeType, limit, offset]);
    return result.rows as Praise[];
  }

  async update(tenantContext: TenantContext, id: string, data: Partial<CreatePraiseDto>, executor?: Pool | PoolClient) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.badge_type !== undefined) {
      updates.push(`badge_type = $${paramCount++}`);
      values.push(data.badge_type);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(data.description);
    }
    if (data.project_id !== undefined) {
      updates.push(`project_id = $${paramCount++}`);
      values.push(data.project_id || null);
    }
    if (data.visibility !== undefined) {
      updates.push(`visibility = $${paramCount++}`);
      values.push(data.visibility);
    }

    updates.push(`updated_at = now(), updated_by = $${paramCount++}`);
    values.push(tenantContext.userId);
    values.push(id);
    values.push(tenantContext.organizationId);

    const query = `
      UPDATE praise
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND organization_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as Praise | undefined;
  }

  async delete(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      DELETE FROM praise
      WHERE id = $1 AND organization_id = $2
      RETURNING *
    `;
    const result = await (executor || this.pool).query(query, [id, tenantContext.organizationId]);
    return result.rows[0] as Praise | undefined;
  }

  async incrementLikesCount(id: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE praise
      SET likes_count = likes_count + 1, updated_at = now()
      WHERE id = $1
      RETURNING likes_count
    `;
    const result = await (executor || this.pool).query(query, [id]);
    return result.rows[0]?.likes_count;
  }

  async decrementLikesCount(id: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE praise
      SET likes_count = GREATEST(0, likes_count - 1), updated_at = now()
      WHERE id = $1
      RETURNING likes_count
    `;
    const result = await (executor || this.pool).query(query, [id]);
    return result.rows[0]?.likes_count;
  }

  async incrementCommentsCount(id: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE praise
      SET comments_count = comments_count + 1, updated_at = now()
      WHERE id = $1
      RETURNING comments_count
    `;
    const result = await (executor || this.pool).query(query, [id]);
    return result.rows[0]?.comments_count;
  }

  async decrementCommentsCount(id: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE praise
      SET comments_count = GREATEST(0, comments_count - 1), updated_at = now()
      WHERE id = $1
      RETURNING comments_count
    `;
    const result = await (executor || this.pool).query(query, [id]);
    return result.rows[0]?.comments_count;
  }
}
