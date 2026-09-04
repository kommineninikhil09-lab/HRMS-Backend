import { SetMetadata, Type } from '@nestjs/common';
import { ResourceResolver } from './resource-resolver.interface';

export interface RequireScopeMeta {
  resolver: Type<ResourceResolver>;
  param: string;
}

/**
 * Marks a route as resource-keyed: the path parameter named `param` is not
 * an employee id but a resource id that *belongs* to an employee. ScopeGuard
 * resolves it via `resolver` (an injectable implementing ResourceResolver)
 * before running the normal scope check.
 *
 * Usage:
 *   @Get('slips/:slipId')
 *   @RequirePermissions('payroll.read')
 *   @RequireScope({ resolver: PayrollSlipResolver, param: 'slipId' })
 *   getSlip(@Param('slipId') slipId: string) { ... }
 */
export const REQUIRE_SCOPE_KEY = 'requireScope';
export const RequireScope = (meta: RequireScopeMeta) => SetMetadata(REQUIRE_SCOPE_KEY, meta);
