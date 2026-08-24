import { Injectable, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersRepository, User } from './users.repository';
import { TenantContext } from '../database/tenant-context';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private usersRepository: UsersRepository,
    @Optional() private auditService?: AuditService,
  ) {}

  async createUser(
    tenantContext: TenantContext,
    userData: {
      email: string;
      password?: string;
      firstName: string;
      lastName: string;
    },
    createdBy?: string,
  ): Promise<User> {
    // Support both old and new signatures
    const { email, firstName, lastName, password } = userData;
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
   * List users by organization with pagination and filtering
   */
  async listUsersByOrganization(
    tenantContext: TenantContext,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      role?: string;
      status?: string;
    },
  ): Promise<{ users: Omit<User, 'passwordHash'>[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    // Use the existing findByOrganization, filtering will be done in repository
    const { users, total } = await this.usersRepository.findByOrganization(
      tenantContext.organizationId,
      limit,
      offset,
    );

    // Strip password hashes from response
    const safeUsers = users.map(({ passwordHash, ...user }) => user);

    return { users: safeUsers, total };
  }
}
