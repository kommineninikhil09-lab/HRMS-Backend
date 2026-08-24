import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';
import { Pool, PoolClient } from 'pg';

export interface Announcement {
  id: string;
  organization_id: string;
  created_by_user_id: string;
  title: string;
  content: string;
  priority: string; // low, medium, high, urgent
  status: string; // published, scheduled, draft, archived
  published_at?: Date;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAnnouncementDto {
  title: string;
  content: string;
  priority?: string;
  status?: string;
  published_at?: Date;
  expires_at?: Date;
}

@Injectable()
export class AnnouncementsRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(tenantContext: TenantContext, data: CreateAnnouncementDto, executor?: Pool | PoolClient) {
    const query = `
      INSERT INTO announcements (organization_id, created_by_user_id, title, content, priority, status, published_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      tenantContext.organizationId,
      tenantContext.userId,
      data.title,
      data.content,
      data.priority || 'medium',
      data.status || 'draft',
      data.published_at || null,
      data.expires_at || null,
    ];
    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as Announcement;
  }

  async findById(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM announcements
      WHERE id = $1 AND organization_id = $2
    `;
    const result = await (executor || this.pool).query(query, [id, tenantContext.organizationId]);
    return result.rows[0] as Announcement | undefined;
  }

  async findByOrganization(tenantContext: TenantContext, status?: string, limit = 20, offset = 0, executor?: Pool | PoolClient) {
    let query = `
      SELECT * FROM announcements
      WHERE organization_id = $1
    `;
    const values: any[] = [tenantContext.organizationId];
    let paramCount = 2;

    if (status) {
      query += ` AND status = $${paramCount++}`;
      values.push(status);
    }

    query += ` ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await (executor || this.pool).query(query, values);
    return result.rows as Announcement[];
  }

  async findActive(tenantContext: TenantContext, limit = 20, offset = 0, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM announcements
      WHERE organization_id = $1 AND status = 'published'
      AND (expires_at IS NULL OR expires_at > now())
      ORDER BY published_at DESC NULLS LAST
      LIMIT $2 OFFSET $3
    `;
    const result = await (executor || this.pool).query(query, [tenantContext.organizationId, limit, offset]);
    return result.rows as Announcement[];
  }

  async findByCreator(tenantContext: TenantContext, userId: string, limit = 20, offset = 0, executor?: Pool | PoolClient) {
    const query = `
      SELECT * FROM announcements
      WHERE organization_id = $1 AND created_by_user_id = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const result = await (executor || this.pool).query(query, [tenantContext.organizationId, userId, limit, offset]);
    return result.rows as Announcement[];
  }

  async update(tenantContext: TenantContext, id: string, data: Partial<CreateAnnouncementDto>, executor?: Pool | PoolClient) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(data.title);
    }
    if (data.content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      values.push(data.content);
    }
    if (data.priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(data.priority);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(data.status);
    }
    if (data.published_at !== undefined) {
      updates.push(`published_at = $${paramCount++}`);
      values.push(data.published_at || null);
    }
    if (data.expires_at !== undefined) {
      updates.push(`expires_at = $${paramCount++}`);
      values.push(data.expires_at || null);
    }

    updates.push(`updated_at = now()`);
    values.push(id);
    values.push(tenantContext.organizationId);

    const query = `
      UPDATE announcements
      SET ${updates.join(', ')}
      WHERE id = $${paramCount + 1} AND organization_id = $${paramCount + 2}
      RETURNING *
    `;

    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as Announcement | undefined;
  }

  async delete(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE announcements
      SET status = 'archived', updated_at = now()
      WHERE id = $1 AND organization_id = $2
      RETURNING *
    `;
    const result = await (executor || this.pool).query(query, [id, tenantContext.organizationId]);
    return result.rows[0] as Announcement | undefined;
  }

  async publish(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE announcements
      SET status = 'published', published_at = now(), updated_at = now()
      WHERE id = $1 AND organization_id = $2 AND status IN ('draft', 'scheduled')
      RETURNING *
    `;
    const result = await (executor || this.pool).query(query, [id, tenantContext.organizationId]);
    return result.rows[0] as Announcement | undefined;
  }

  async schedule(tenantContext: TenantContext, id: string, publishAt: Date, executor?: Pool | PoolClient) {
    const query = `
      UPDATE announcements
      SET status = 'scheduled', published_at = $1, updated_at = now()
      WHERE id = $2 AND organization_id = $3 AND status IN ('draft', 'scheduled')
      RETURNING *
    `;
    const result = await (executor || this.pool).query(query, [publishAt, id, tenantContext.organizationId]);
    return result.rows[0] as Announcement | undefined;
  }
}
