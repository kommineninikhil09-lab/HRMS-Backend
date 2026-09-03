import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '../../database/tenant-context';

/**
 * Resolves the per-request {@link TenantContext} populated by `JwtAuthGuard`
 * ({ organizationId, userId, employeeId, requestId }).
 *
 * NOTE: historically this returned the raw JWT payload ({ sub, organizationId,
 * email }), which is why some call sites read `.userId` / `.requestId` as
 * `undefined`. It now returns the full tenant context.
 */
export const CurrentUser = createParamDecorator(
  (_data, ctx: ExecutionContext): TenantContext =>
    (ctx.switchToHttp().getRequest() as any).tenantContext as TenantContext,
);
