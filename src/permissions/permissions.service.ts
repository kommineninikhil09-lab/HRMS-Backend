import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { PermissionsRepository, Permission } from './permissions.repository';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { Pool } from 'pg';
import { POOL_PROVIDER } from '../database/pool.provider';

@Injectable()
export class PermissionsService {
  constructor(
    private permissionsRepository: PermissionsRepository,
    @Inject(POOL_PROVIDER) private pool: Pool,
  ) {}

  async seedDefaultPermissions(): Promise<void> {
    const permissionEntries = Object.entries(PERMISSIONS);

    for (const [key, code] of permissionEntries) {
      const existing = await this.permissionsRepository.findByCode(code);
      if (!existing) {
        const module = code.split('.')[0];
        await this.permissionsRepository.create({
          code,
          description: `${key.replace(/_/g, ' ').toLowerCase()}`,
          module,
        });
      }
    }
  }

  async getPermissionById(id: string): Promise<Permission | null> {
    return this.permissionsRepository.findById(id);
  }

  async getPermissionByCode(code: string): Promise<Permission | null> {
    return this.permissionsRepository.findByCode(code);
  }

  async listPermissions(
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ permissions: Permission[]; total: number }> {
    return this.permissionsRepository.findAll(limit, offset);
  }

  async listPermissionsByModule(
    module: string,
  ): Promise<Permission[]> {
    return this.permissionsRepository.findByModule(module);
  }

  async getEffectivePermissions(
    organizationId: string,
    userId: string,
  ): Promise<string[]> {
    const query = `
      SELECT DISTINCT p.code
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.organization_id = $1
        AND ur.user_id = $2
        AND r.organization_id = $1
    `;

    const result = await this.pool.query<{ code: string }>(query, [
      organizationId,
      userId,
    ]);

    return result.rows.map((row) => row.code);
  }

  async getUserRoles(
    organizationId: string,
    userId: string,
  ): Promise<{ id: string; name: string }[]> {
    const query = `
      SELECT r.id, r.name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.organization_id = $1
        AND ur.user_id = $2
        AND r.organization_id = $1
      ORDER BY r.name
    `;

    const result = await this.pool.query<{ id: string; name: string }>(query, [
      organizationId,
      userId,
    ]);

    return result.rows;
  }

  async listRoles(
    organizationId: string,
  ): Promise<{ id: string; name: string }[]> {
    const query = `
      SELECT id, name
      FROM roles
      WHERE organization_id = $1
      ORDER BY name ASC
    `;

    const result = await this.pool.query<{ id: string; name: string }>(query, [organizationId]);
    return result.rows;
  }
}
