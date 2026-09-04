import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface TenantContext {
  organizationId: string;
  userId: string;
  requestId: string;
  /**
   * Populated by ScopeGuard on list routes (routes with neither @ScopeParam
   * nor @RequireScope): the employee ids the caller's scope permits, or the
   * sentinel 'ALL' for ORGANIZATION scope. Repositories pass this straight
   * into a `WHERE employee_id = ANY($ids)` clause — list endpoints must
   * never fetch everything and filter in application code.
   */
  scopedEmployeeIds?: 'ALL' | string[];
}

export const TenantContextDecorator = createParamDecorator(
  (_data, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as any).tenantContext as TenantContext;
  },
);
