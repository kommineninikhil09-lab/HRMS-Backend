import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Pool } from 'pg';
import { POOL_PROVIDER } from '../../database/pool.provider';
import { TenantContext } from '../../database/tenant-context';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(POOL_PROVIDER) private pool: Pool,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Get required permissions from decorator
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Get the request and tenant context
    const request = context.switchToHttp().getRequest();
    const tenantContext: TenantContext = (request as any).tenantContext;
    const user = (request as any).user;

    if (!tenantContext || !user) {
      throw new ForbiddenException('Missing authentication context');
    }

    // Get user's effective permissions from database
    const effectivePermissions = await this.getEffectivePermissions(
      tenantContext.organizationId,
      tenantContext.userId,
    );

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every((required) =>
      effectivePermissions.includes(required),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `Missing required permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }

  /**
   * Get user's effective permissions by joining:
   * user_roles → roles → role_permissions → permissions
   */
  private async getEffectivePermissions(
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
}
