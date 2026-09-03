import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface TenantContext {
  organizationId: string;
  userId: string;
  /**
   * The employee record linked to this user (`employees.user_id`), resolved once
   * per request by `JwtAuthGuard`. `null` when the user has no employee profile
   * (e.g. a service/admin account). Endpoints that operate on "my" employee data
   * should read this rather than passing `userId` where an employee id is expected.
   */
  employeeId: string | null;
  requestId: string;
}

export const TenantContextDecorator = createParamDecorator(
  (_data, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as any).tenantContext as TenantContext;
  },
);
