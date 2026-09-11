import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { TenantContext, ORG_SCOPE } from '../database/tenant-context';

/**
 * P1-08 — verification, not new implementation. getLeaveRequestById already
 * implements the resource-keyed fetch-then-assert pattern (no resolver class
 * needed): the request is visible to its owner, its assigned approver, or a
 * caller who both holds leave.approve and has the request's employee within
 * their management scope. Confirmed by reading the file; these tests are the
 * acceptance-criteria evidence.
 */
function makeContext(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    organizationId: 'org-1',
    userId: 'user-1',
    employeeId: 'self-employee-1',
    requestId: 'req-1',
    permissions: [],
    ...overrides,
  };
}

describe('LeaveService.getLeaveRequestById — resource-keyed authorization (P1-08)', () => {
  let leaveRequestsRepo: any;
  let permissionsService: any;
  let service: LeaveService;

  const request = {
    id: 'request-1',
    employee_id: 'target-employee-1',
    approver_id: 'assigned-approver-user-1',
  };

  beforeEach(() => {
    leaveRequestsRepo = { findById: jest.fn().mockResolvedValue(request) };
    permissionsService = { getEffectivePermissions: jest.fn().mockResolvedValue([]) };
    service = new LeaveService(
      {} as any,
      leaveRequestsRepo,
      {} as any,
      {} as any,
      {} as any,
      permissionsService,
      {} as any,
      {} as any,
    );
  });

  it('throws NotFoundException for a nonexistent request', async () => {
    leaveRequestsRepo.findById.mockResolvedValueOnce(undefined);
    const ctx = makeContext();
    await expect(service.getLeaveRequestById(ctx, 'missing')).rejects.toThrow(NotFoundException);
  });

  it('the owner can always view their own request, no permission or scope needed', async () => {
    const ctx = makeContext({ employeeId: 'target-employee-1', permissions: [] });
    await expect(service.getLeaveRequestById(ctx, 'request-1')).resolves.toEqual(request);
  });

  it('the assigned approver can always view it, even without leave.approve or matching scope', async () => {
    const ctx = makeContext({
      employeeId: 'someone-else',
      userId: 'assigned-approver-user-1',
      permissions: [],
    });
    await expect(service.getLeaveRequestById(ctx, 'request-1')).resolves.toEqual(request);
  });

  it('a non-owner, non-approver without leave.approve gets 403 without any scope check', async () => {
    const ctx = makeContext({ employeeId: 'someone-else', userId: 'random-user', permissions: [] });
    await expect(service.getLeaveRequestById(ctx, 'request-1')).rejects.toThrow(
      'You are not allowed to view this leave request',
    );
  });

  it('holding leave.approve with the employee in scope (team) succeeds', async () => {
    const ctx = makeContext({
      employeeId: 'someone-else',
      userId: 'manager-1',
      permissions: ['leave.approve'],
      scope: { kind: 'team', employeeIds: new Set(['target-employee-1']) },
    });
    await expect(service.getLeaveRequestById(ctx, 'request-1')).resolves.toEqual(request);
  });

  it('holding leave.approve but the employee outside scope (team) still 403s', async () => {
    const ctx = makeContext({
      employeeId: 'someone-else',
      userId: 'manager-1',
      permissions: ['leave.approve'],
      scope: { kind: 'team', employeeIds: new Set(['not-the-target']) },
    });
    await expect(service.getLeaveRequestById(ctx, 'request-1')).rejects.toThrow(
      'This employee is outside your management scope',
    );
  });

  it('holding leave.approve with org scope succeeds for any employee', async () => {
    const ctx = makeContext({
      employeeId: 'someone-else',
      userId: 'super-admin-1',
      permissions: ['leave.approve'],
      scope: ORG_SCOPE,
    });
    await expect(service.getLeaveRequestById(ctx, 'request-1')).resolves.toEqual(request);
  });

  it('falls back to PermissionsService when tenantContext.permissions is undefined', async () => {
    permissionsService.getEffectivePermissions.mockResolvedValueOnce(['leave.approve']);
    const ctx = makeContext({
      employeeId: 'someone-else',
      userId: 'manager-1',
      permissions: undefined,
      scope: ORG_SCOPE,
    });
    await expect(service.getLeaveRequestById(ctx, 'request-1')).resolves.toEqual(request);
    expect(permissionsService.getEffectivePermissions).toHaveBeenCalledWith('org-1', 'manager-1');
  });
});
