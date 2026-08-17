import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { RolesRepository, Role } from './roles.repository';
import { TenantContext } from '../database/tenant-context';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RolesService {
  constructor(
    private rolesRepository: RolesRepository,
    @Optional() private auditService?: AuditService,
  ) {}

  async createRole(
    tenantContext: TenantContext,
    name: string,
    description?: string,
  ): Promise<Role> {
    // Check if role already exists
    const existing = await this.rolesRepository.findByName(
      tenantContext.organizationId,
      name,
    );

    if (existing) {
      throw new BadRequestException(`Role "${name}" already exists`);
    }

    const role = await this.rolesRepository.create(
      {
        organizationId: tenantContext.organizationId,
        name,
        description,
        isSystem: false,
      },
    );

    // Record audit event
    if (this.auditService) {
      await this.auditService.auditRoleCreated(
        tenantContext,
        role.id,
        name,
      );
    }

    return role;
  }

  async getRoleById(
    tenantContext: TenantContext,
    roleId: string,
  ): Promise<Role> {
    const role = await this.rolesRepository.findById(
      tenantContext.organizationId,
      roleId,
    );

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async getRoleByName(
    tenantContext: TenantContext,
    name: string,
  ): Promise<Role> {
    const role = await this.rolesRepository.findByName(
      tenantContext.organizationId,
      name,
    );

    if (!role) {
      throw new NotFoundException(`Role "${name}" not found`);
    }

    return role;
  }

  async listRoles(
    tenantContext: TenantContext,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ roles: Role[]; total: number }> {
    return this.rolesRepository.findByOrganization(
      tenantContext.organizationId,
      limit,
      offset,
    );
  }

  async updateRole(
    tenantContext: TenantContext,
    roleId: string,
    data: Partial<{
      name: string;
      description: string;
    }>,
  ): Promise<Role> {
    // If updating name, check for conflicts
    if (data.name) {
      const existing = await this.rolesRepository.findByName(
        tenantContext.organizationId,
        data.name,
      );

      if (existing && existing.id !== roleId) {
        throw new BadRequestException(`Role "${data.name}" already exists`);
      }
    }

    // Get old values for audit
    const oldRole = await this.rolesRepository.findById(
      tenantContext.organizationId,
      roleId,
    );

    if (!oldRole) {
      throw new NotFoundException('Role not found');
    }

    const role = await this.rolesRepository.update(
      tenantContext.organizationId,
      roleId,
      data,
      tenantContext.userId,
    );

    // Record audit event
    if (this.auditService && data && Object.keys(data).length > 0) {
      const oldValue: Record<string, any> = {};
      const newValue: Record<string, any> = {};

      if ('name' in data) {
        oldValue.name = oldRole.name;
        newValue.name = role.name;
      }
      if ('description' in data) {
        oldValue.description = oldRole.description;
        newValue.description = role.description;
      }

      await this.auditService.auditRoleUpdated(
        tenantContext,
        roleId,
        oldValue,
        newValue,
      );
    }

    return role;
  }

  async deleteRole(
    tenantContext: TenantContext,
    roleId: string,
  ): Promise<void> {
    const role = await this.getRoleById(tenantContext, roleId);

    if (role.isSystem) {
      throw new BadRequestException('Cannot delete system roles');
    }

    await this.rolesRepository.delete(tenantContext.organizationId, roleId);

    // Record audit event
    if (this.auditService) {
      await this.auditService.auditRoleDeleted(
        tenantContext,
        roleId,
        role.name,
      );
    }
  }
}
