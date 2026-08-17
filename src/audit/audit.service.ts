import { Injectable, Inject, Optional } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import { AuditRepository, CreateAuditLogData, AuditLog } from './audit.repository';
import { Pool, PoolClient } from 'pg';
import { TenantContext } from '../database/tenant-context';

@Injectable()
export class AuditService {
  constructor(
    private auditRepository: AuditRepository,
    @Optional() @Inject(REQUEST) private request?: Request,
  ) {}

  /**
   * Record an audit event (overloaded for both object and individual parameter patterns)
   * Should be called atomically with the mutation it's auditing
   */
  async record(
    tenantContext: TenantContext,
    actionOrObject: string | { action: string; entity_type: string; entity_id?: string; old_value?: Record<string, any>; new_value?: Record<string, any> },
    entityType?: string,
    entityId?: string,
    oldValue?: Record<string, any>,
    newValue?: Record<string, any>,
    executor?: Pool | PoolClient,
  ): Promise<AuditLog> {
    let action: string;
    let entityTypeVal: string;
    let entityIdVal: string | undefined;
    let oldValueVal: Record<string, any> | undefined;
    let newValueVal: Record<string, any> | undefined;
    let executorVal: Pool | PoolClient | undefined;

    // Handle both calling patterns
    if (typeof actionOrObject === 'object') {
      // Object pattern: record(tenantContext, { action, entity_type, ... }, executor)
      action = actionOrObject.action;
      entityTypeVal = actionOrObject.entity_type;
      entityIdVal = actionOrObject.entity_id;
      oldValueVal = actionOrObject.old_value;
      newValueVal = actionOrObject.new_value;
      executorVal = entityType as any; // Third param is actually the executor in object pattern
    } else {
      // Individual parameter pattern: record(tenantContext, action, entityType, ...)
      action = actionOrObject;
      entityTypeVal = entityType!;
      entityIdVal = entityId;
      oldValueVal = oldValue;
      newValueVal = newValue;
      executorVal = executor;
    }

    const auditData: CreateAuditLogData = {
      organizationId: tenantContext.organizationId,
      requestId: tenantContext.requestId,
      actorUserId: tenantContext.userId,
      action,
      entityType: entityTypeVal,
      entityId: entityIdVal,
      oldValue: oldValueVal,
      newValue: newValueVal,
      ipAddress: this.getClientIp(),
      userAgent: this.getClientUserAgent(),
    };

    return this.auditRepository.create(auditData, executorVal);
  }

  /**
   * Record a user creation audit event
   */
  async auditUserCreated(
    tenantContext: TenantContext,
    userId: string,
    email: string,
    executor?: Pool | PoolClient,
  ): Promise<AuditLog> {
    return this.record(
      tenantContext,
      'create',
      'user',
      userId,
      undefined,
      { email },
      executor,
    );
  }

  /**
   * Record a user update audit event
   */
  async auditUserUpdated(
    tenantContext: TenantContext,
    userId: string,
    oldData: Record<string, any>,
    newData: Record<string, any>,
    executor?: Pool | PoolClient,
  ): Promise<AuditLog> {
    return this.record(
      tenantContext,
      'update',
      'user',
      userId,
      oldData,
      newData,
      executor,
    );
  }

  /**
   * Record a user deletion audit event
   */
  async auditUserDeleted(
    tenantContext: TenantContext,
    userId: string,
    email: string,
    executor?: Pool | PoolClient,
  ): Promise<AuditLog> {
    return this.record(
      tenantContext,
      'delete',
      'user',
      userId,
      { email },
      undefined,
      executor,
    );
  }

  /**
   * Record a role creation audit event
   */
  async auditRoleCreated(
    tenantContext: TenantContext,
    roleId: string,
    roleName: string,
    executor?: Pool | PoolClient,
  ): Promise<AuditLog> {
    return this.record(
      tenantContext,
      'create',
      'role',
      roleId,
      undefined,
      { name: roleName },
      executor,
    );
  }

  /**
   * Record a role update audit event
   */
  async auditRoleUpdated(
    tenantContext: TenantContext,
    roleId: string,
    oldData: Record<string, any>,
    newData: Record<string, any>,
    executor?: Pool | PoolClient,
  ): Promise<AuditLog> {
    return this.record(
      tenantContext,
      'update',
      'role',
      roleId,
      oldData,
      newData,
      executor,
    );
  }

  /**
   * Record a role deletion audit event
   */
  async auditRoleDeleted(
    tenantContext: TenantContext,
    roleId: string,
    roleName: string,
    executor?: Pool | PoolClient,
  ): Promise<AuditLog> {
    return this.record(
      tenantContext,
      'delete',
      'role',
      roleId,
      { name: roleName },
      undefined,
      executor,
    );
  }

  /**
   * Record a permission assignment audit event
   */
  async auditPermissionAssigned(
    tenantContext: TenantContext,
    roleId: string,
    permissionCode: string,
    executor?: Pool | PoolClient,
  ): Promise<AuditLog> {
    return this.record(
      tenantContext,
      'assign',
      'role_permission',
      `${roleId}:${permissionCode}`,
      undefined,
      { roleId, permissionCode },
      executor,
    );
  }

  /**
   * Record a role assignment audit event (user to role)
   */
  async auditRoleAssigned(
    tenantContext: TenantContext,
    userId: string,
    roleId: string,
    executor?: Pool | PoolClient,
  ): Promise<AuditLog> {
    return this.record(
      tenantContext,
      'assign',
      'user_role',
      `${userId}:${roleId}`,
      undefined,
      { userId, roleId },
      executor,
    );
  }

  /**
   * Record a login audit event
   */
  async auditLogin(
    organizationId: string,
    userId: string,
    email: string,
    requestId: string,
  ): Promise<AuditLog> {
    const auditData: CreateAuditLogData = {
      organizationId,
      requestId,
      actorUserId: userId,
      action: 'login',
      entityType: 'user',
      entityId: userId,
      newValue: { email },
      ipAddress: this.getClientIp(),
      userAgent: this.getClientUserAgent(),
    };

    return this.auditRepository.create(auditData);
  }

  /**
   * Get client IP address from request
   */
  private getClientIp(): string | undefined {
    if (!this.request) return undefined;

    return (
      (this.request.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      (this.request.headers['x-real-ip'] as string) ||
      (this.request.socket?.remoteAddress || '').split(':').pop()
    );
  }

  /**
   * Get client user agent from request
   */
  private getClientUserAgent(): string | undefined {
    if (!this.request) return undefined;
    return this.request.headers['user-agent'] as string;
  }
}
