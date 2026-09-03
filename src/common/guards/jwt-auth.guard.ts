import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Pool } from 'pg';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Request } from 'express';
import { TenantContext } from '../../database/tenant-context';
import { POOL_PROVIDER } from '../../database/pool.provider';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt-access') {
  constructor(
    private reflector: Reflector,
    @Inject(POOL_PROVIDER) private pool: Pool,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Runs the passport strategy, which triggers handleRequest() below and
    // populates request.user + a partial request.tenantContext.
    const activated = (await super.canActivate(context)) as boolean;
    if (!activated) {
      return false;
    }

    // Resolve the linked employee record once per request. `employeeId` is left
    // `undefined` by handleRequest() as a "not yet resolved" sentinel so this
    // only runs once even when the guard is applied both globally and on the
    // controller.
    const request = context.switchToHttp().getRequest<Request>();
    const tenantContext = (request as any).tenantContext as TenantContext;
    if (tenantContext && (tenantContext as any).employeeId === undefined) {
      const result = await this.pool.query<{ id: string }>(
        'SELECT id FROM employees WHERE user_id = $1 AND organization_id = $2 LIMIT 1',
        [tenantContext.userId, tenantContext.organizationId],
      );
      tenantContext.employeeId = result.rows[0]?.id ?? null;
    }

    return true;
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or missing token');
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Partial tenant context from JWT claims; employeeId is resolved in
    // canActivate() (async DB lookup is not possible here).
    const tenantContext = {
      organizationId: user.organizationId,
      userId: user.sub,
      requestId: (request as any).requestId,
    } as TenantContext;

    (request as any).user = user;
    (request as any).tenantContext = tenantContext;

    return user;
  }
}
