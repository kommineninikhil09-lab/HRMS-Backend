import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Optional,
  Inject,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersRepository, User } from './users.repository';
import { TenantContext } from '../database/tenant-context';
import { AuditService } from '../audit/audit.service';
import { TransactionService } from '../database/transaction.service';
import { Pool } from 'pg';
import { POOL_PROVIDER } from '../database/pool.provider';

@Injectable()
export class UsersService {
  constructor(
    private usersRepository: UsersRepository,
    private readonly transactionService: TransactionService,
    @Optional() private auditService?: AuditService,
    @Inject(POOL_PROVIDER) private pool?: Pool,
  ) {}

  async createUser(
    tenantContext: TenantContext,
    email: string,
    firstName: string,
    lastName: string,
    password?: string,
  ): Promise<User> {
    // Check if user already exists
    const existing = await this.usersRepository.findByEmailInOrganization(
      tenantContext.organizationId,
      email,
    );

    if (existing) {
      throw new BadRequestException('User with this email already exists');
    }

    let passwordHash: string | undefined;
    if (password) {
      passwordHash = await bcrypt.hash(password, 12);
    }

    const user = await this.usersRepository.create(
      {
        organizationId: tenantContext.organizationId,
        email,
        firstName,
        lastName,
        passwordHash,
        authProvider: 'local',
      },
    );

    // Record audit event
    if (this.auditService) {
      await this.auditService.auditUserCreated(
        tenantContext,
        user.id,
        email,
      );
    }

    return user;
  }

  async getUserById(
    tenantContext: TenantContext,
    userId: string,
  ): Promise<User> {
    const user = await this.usersRepository.findById(
      tenantContext.organizationId,
      userId,
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async listUsers(
    tenantContext: TenantContext,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ users: Omit<User, 'passwordHash'>[]; total: number }> {
    const { users, total } = await this.usersRepository.findByOrganization(
      tenantContext.organizationId,
      limit,
      offset,
    );

    // Strip password hashes from response
    const safeUsers = users.map(({ passwordHash, ...user }) => user);

    return { users: safeUsers, total };
  }

  async updateUser(
    tenantContext: TenantContext,
    userId: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      status: string;
    }>,
  ): Promise<User> {
    // Get old values for audit
    const oldUser = await this.usersRepository.findById(
      tenantContext.organizationId,
      userId,
    );

    if (!oldUser) {
      throw new NotFoundException('User not found');
    }

    const user = await this.usersRepository.update(
      tenantContext.organizationId,
      userId,
      data,
      tenantContext.userId,
    );

    // Record audit event
    if (this.auditService && data && Object.keys(data).length > 0) {
      const oldValue: Record<string, any> = {};
      const newValue: Record<string, any> = {};

      if ('firstName' in data) {
        oldValue.firstName = oldUser.firstName;
        newValue.firstName = user.firstName;
      }
      if ('lastName' in data) {
        oldValue.lastName = oldUser.lastName;
        newValue.lastName = user.lastName;
      }
      if ('status' in data) {
        oldValue.status = oldUser.status;
        newValue.status = user.status;
      }

      await this.auditService.auditUserUpdated(
        tenantContext,
        userId,
        oldValue,
        newValue,
      );
    }

    return user;
  }

  async validatePassword(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.usersRepository.findByEmail(email);

    if (!user || !user.passwordHash) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  async updateLastLogin(organizationId: string, userId: string): Promise<void> {
    await this.usersRepository.update(
      organizationId,
      userId,
      { lastLoginAt: new Date() },
      userId,
    );
  }

  /**
   * Set a user's **single primary role** (one role per organization/user).
   * Replaces whatever role they currently hold.
   *
   * Anti-escalation: the caller may only assign a role whose permission set is a
   * subset of their own effective permissions — so an Admin can never grant
   * Super Admin. (The endpoint is already `role.assign`-gated; this is
   * defence-in-depth and the extension point for future delegated assignment.)
   */
  async assignRoleToUser(
    tenantContext: TenantContext,
    userId: string,
    roleId: string,
  ): Promise<void> {
    if (!this.pool) {
      throw new Error('Database pool not available');
    }

    const roleCheck = await this.pool.query<{ id: string }>(
      'SELECT id FROM roles WHERE id = $1 AND organization_id = $2',
      [roleId, tenantContext.organizationId],
    );
    if (roleCheck.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }

    const { rows: targetPerms } = await this.pool.query<{ code: string }>(
      `SELECT p.code
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1`,
      [roleId],
    );
    const callerPerms = new Set(tenantContext.permissions ?? []);
    const escalates = targetPerms.some((p) => !callerPerms.has(p.code));
    if (escalates) {
      throw new ForbiddenException(
        'You cannot assign a role that grants permissions you do not hold',
      );
    }

    await this.transactionService.runInTransaction(async (client) => {
      await client.query(
        'DELETE FROM user_roles WHERE organization_id = $1 AND user_id = $2',
        [tenantContext.organizationId, userId],
      );
      await client.query(
        `INSERT INTO user_roles (organization_id, user_id, role_id, assigned_by)
         VALUES ($1, $2, $3, $4)`,
        [tenantContext.organizationId, userId, roleId, tenantContext.userId],
      );
    });

    if (this.auditService) {
      await this.auditService.auditRoleAssigned(tenantContext, userId, roleId);
    }
  }
}
