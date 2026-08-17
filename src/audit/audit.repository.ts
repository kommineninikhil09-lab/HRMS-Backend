import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { BaseRepository } from '../database/base.repository';

export interface AuditLog {
  id: string;
  organizationId: string;
  requestId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: Record<string, any> | null;
  newValue: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface CreateAuditLogData {
  organizationId: string;
  requestId?: string;
  actorUserId?: string;
  action: string; // create, update, delete, login, status_change, etc.
  entityType: string;
  entityId?: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditRepository extends BaseRepository {
  /**
   * Create an audit log entry (append-only, never updated)
   */
  async create(
    data: CreateAuditLogData,
    executor: Pool | PoolClient = this.pool,
  ): Promise<AuditLog> {
    const query = `
      INSERT INTO audit_logs (
        organization_id, request_id, actor_user_id, action,
        entity_type, entity_id, old_value, new_value,
        ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      data.organizationId,
      data.requestId || null,
      data.actorUserId || null,
      data.action,
      data.entityType,
      data.entityId || null,
      data.oldValue ? JSON.stringify(data.oldValue) : null,
      data.newValue ? JSON.stringify(data.newValue) : null,
      data.ipAddress || null,
      data.userAgent || null,
    ];

    const result = await this.query<AuditLog>(query, values, executor);
    return result.rows[0];
  }

  /**
   * Get audit logs for an organization
   * Ordered by creation time (newest first)
   */
  async findByOrganization(
    organizationId: string,
    limit: number = 100,
    offset: number = 0,
    executor: Pool | PoolClient = this.pool,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const countQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs
      WHERE organization_id = $1
    `;

    const dataQuery = `
      SELECT *
      FROM audit_logs
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countResult = await this.query<{ total: string }>(
      countQuery,
      [organizationId],
      executor,
    );

    const dataResult = await this.query<AuditLog>(
      dataQuery,
      [organizationId, limit, offset],
      executor,
    );

    return {
      logs: dataResult.rows,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  /**
   * Get audit logs for a specific entity
   */
  async findByEntity(
    organizationId: string,
    entityType: string,
    entityId: string,
    limit: number = 100,
    offset: number = 0,
    executor: Pool | PoolClient = this.pool,
  ): Promise<AuditLog[]> {
    const query = `
      SELECT *
      FROM audit_logs
      WHERE organization_id = $1
        AND entity_type = $2
        AND entity_id = $3
      ORDER BY created_at DESC
      LIMIT $4 OFFSET $5
    `;

    const result = await this.query<AuditLog>(
      query,
      [organizationId, entityType, entityId, limit, offset],
      executor,
    );

    return result.rows;
  }

  /**
   * Get audit logs for a specific action/actor
   */
  async findByActor(
    organizationId: string,
    actorUserId: string,
    limit: number = 100,
    offset: number = 0,
    executor: Pool | PoolClient = this.pool,
  ): Promise<AuditLog[]> {
    const query = `
      SELECT *
      FROM audit_logs
      WHERE organization_id = $1
        AND actor_user_id = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await this.query<AuditLog>(
      query,
      [organizationId, actorUserId, limit, offset],
      executor,
    );

    return result.rows;
  }

  /**
   * Get audit logs within a date range
   */
  async findByDateRange(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 100,
    offset: number = 0,
    executor: Pool | PoolClient = this.pool,
  ): Promise<AuditLog[]> {
    const query = `
      SELECT *
      FROM audit_logs
      WHERE organization_id = $1
        AND created_at >= $2
        AND created_at <= $3
      ORDER BY created_at DESC
      LIMIT $4 OFFSET $5
    `;

    const result = await this.query<AuditLog>(
      query,
      [organizationId, startDate, endDate, limit, offset],
      executor,
    );

    return result.rows;
  }
}
