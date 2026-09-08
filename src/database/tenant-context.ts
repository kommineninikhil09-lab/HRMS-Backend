import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * The set of employees a principal may act on ("who").
 *
 *  - `org`   — organisation-wide (holds `scope.all`; e.g. Super Admin).
 *  - `team`  — only the employees in `employeeIds`, resolved from the
 *              principal's `manager_scopes` rows (team / department assignments).
 *  - `self`  — nobody but themselves (a plain Employee, or an Admin with no
 *              management scope assigned yet — fail-closed).
 *
 * Resolved once per request by `JwtAuthGuard` from the principal's effective
 * permissions + `manager_scopes`. Authorization code branches on this, never on
 * role names.
 */
export type ManagementScope =
  | { kind: 'org' }
  | { kind: 'team'; employeeIds: ReadonlySet<string> }
  | { kind: 'self' };

export const ORG_SCOPE: ManagementScope = { kind: 'org' };
export const SELF_SCOPE: ManagementScope = { kind: 'self' };

export interface TenantContext {
  organizationId: string;
  userId: string;
  /**
   * The employee record linked to this user (`employees.user_id`), resolved once
   * per request by `JwtAuthGuard`. `null` when the user has no employee profile
   * (e.g. a service/admin account). Endpoints that operate on "my …" data should
   * read this rather than passing `userId` where an employee id is expected.
   */
  employeeId: string | null;
  requestId: string;
  /**
   * Effective permission codes for this principal, resolved once per request by
   * `JwtAuthGuard`. Optional so non-HTTP callers / test fixtures that build a
   * bare context still type-check; consumers must tolerate `undefined`.
   */
  permissions?: string[];
  /**
   * Resolved management scope for this principal (see {@link ManagementScope}).
   * Optional for the same reason as `permissions`; consumers treat `undefined`
   * as `{ kind: 'self' }` (fail-closed).
   */
  scope?: ManagementScope;
}

export const TenantContextDecorator = createParamDecorator(
  (_data, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as any).tenantContext as TenantContext;
  },
);
