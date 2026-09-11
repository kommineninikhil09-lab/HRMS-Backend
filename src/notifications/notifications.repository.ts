import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { BaseRepository } from '../database/base.repository';
import { TenantContext } from '../database/tenant-context';

export interface Notification {
  id: string;
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  readAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class NotificationsRepository extends BaseRepository {
  async create(
    organizationId: string,
    userId: string,
    type: string,
    title: string,
    body: string | undefined,
    executor?: Pool | PoolClient,
  ): Promise<Notification> {
    return (await this.queryOne<Notification>(
      `INSERT INTO notifications (organization_id, user_id, type, title, body)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [organizationId, userId, type, title, body ?? null],
      executor,
    )) as Notification;
  }

  async findRecentForUser(
    tenantContext: TenantContext,
    limit: number,
    executor?: Pool | PoolClient,
  ): Promise<Notification[]> {
    const result = await this.query<Notification>(
      `SELECT * FROM notifications
       WHERE organization_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [tenantContext.organizationId, tenantContext.userId, limit],
      executor,
    );
    return result.rows;
  }

  async countUnreadForUser(
    tenantContext: TenantContext,
    executor?: Pool | PoolClient,
  ): Promise<number> {
    const result = await this.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM notifications
       WHERE organization_id = $1 AND user_id = $2 AND read_at IS NULL`,
      [tenantContext.organizationId, tenantContext.userId],
      executor,
    );
    return parseInt(result.rows[0].count, 10);
  }

  async markRead(
    tenantContext: TenantContext,
    id: string,
    executor?: Pool | PoolClient,
  ): Promise<Notification | null> {
    return this.queryOne<Notification>(
      `UPDATE notifications
       SET read_at = now()
       WHERE id = $1 AND organization_id = $2 AND user_id = $3 AND read_at IS NULL
       RETURNING *`,
      [id, tenantContext.organizationId, tenantContext.userId],
      executor,
    );
  }

  async markAllRead(
    tenantContext: TenantContext,
    executor?: Pool | PoolClient,
  ): Promise<number> {
    const result = await this.query(
      `UPDATE notifications
       SET read_at = now()
       WHERE organization_id = $1 AND user_id = $2 AND read_at IS NULL`,
      [tenantContext.organizationId, tenantContext.userId],
      executor,
    );
    return result.rowCount ?? 0;
  }
}
