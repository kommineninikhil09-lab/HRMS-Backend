import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { TenantContext, ORG_SCOPE, SELF_SCOPE } from '../database/tenant-context';

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

/**
 * P1-10 — verification, not new implementation. Both getLeaveBalance
 * (backing GET balance/employee/:employeeId) and getEmployeeLeaveRequests
 * (backing GET employee/:employeeId/requests) already call
 * assertActingOnEmployee(tenantContext, employeeId) as their first line —
 * confirmed by reading leave.service.ts. These tests are the
 * acceptance-criteria evidence for that, not a retrofit.
 */
describe('LeaveService.getLeaveBalance — scope-gated by employeeId (P1-10)', () => {
  let leaveBalanceRepo: any;
  let service: LeaveService;

  beforeEach(() => {
    leaveBalanceRepo = {
      findByEmployee: jest.fn().mockResolvedValue([
        { opening_balance: 0, allocated: 12, carry_forward: 0, used: 2, pending: 1 },
      ]),
    };
    service = new LeaveService(
      {} as any,
      {} as any,
      leaveBalanceRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('team scope: succeeds for an in-scope target, 403s for an out-of-scope one', async () => {
    const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-1']) } });
    await expect(service.getLeaveBalance(ctxIn, 'target-1')).resolves.toBeDefined();

    const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
    await expect(service.getLeaveBalance(ctxOut, 'target-1')).rejects.toThrow(ForbiddenException);
  });

  it('self scope: 403s for anyone other than yourself', async () => {
    const ctx = makeContext({ employeeId: 'someone-else', scope: SELF_SCOPE });
    await expect(service.getLeaveBalance(ctx, 'target-1')).rejects.toThrow(ForbiddenException);
    expect(leaveBalanceRepo.findByEmployee).not.toHaveBeenCalled();
  });

  it('org scope: succeeds for any target', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    await expect(service.getLeaveBalance(ctx, 'target-1')).resolves.toBeDefined();
  });
});

describe('LeaveService.getEmployeeLeaveRequests — scope-gated by employeeId (P1-10)', () => {
  let leaveRequestsRepo: any;
  let service: LeaveService;

  beforeEach(() => {
    leaveRequestsRepo = { findByEmployee: jest.fn().mockResolvedValue([]) };
    service = new LeaveService(
      {} as any,
      leaveRequestsRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('team scope: succeeds for an in-scope target, 403s for an out-of-scope one', async () => {
    const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-1']) } });
    await expect(service.getEmployeeLeaveRequests(ctxIn, 'target-1')).resolves.toEqual([]);

    const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
    await expect(service.getEmployeeLeaveRequests(ctxOut, 'target-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('org scope: succeeds for any target', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    await expect(service.getEmployeeLeaveRequests(ctx, 'target-1')).resolves.toEqual([]);
  });
});

/**
 * P1-07 — verification, but the task as originally written doesn't match
 * this module. There is no manager-facing "all leave requests in my scope"
 * list to scope-filter, parallel to Employees' getAll:
 *
 *   - `GET requests` (getEmployeeLeaveRequests, called with the caller's own
 *     id via requireEmployeeId) is self-only by design, like ESS — not a
 *     list a manager ever sees anyone else's data through.
 *   - `GET approvals/pending` (getPendingApprovals) is scoped by explicit
 *     `approver_id` assignment on each request (findPendingApprovals),
 *     independent of manager_scopes entirely — a different, already-correct
 *     mechanism, not something scopedEmployeeIds should be layered onto.
 *   - `GET employee/:employeeId/requests` (also getEmployeeLeaveRequests,
 *     this time with a path-param id) already calls assertActingOnEmployee
 *     — that's P1-10's target, already done.
 *
 * These tests confirm both existing behaviors rather than retrofitting
 * scopedEmployeeIds onto either — doing that to `GET requests` specifically
 * would be a real regression: it would turn a user's own leave list into
 * their whole management scope's, breaking the self-service page.
 */
describe('LeaveService — list-endpoint verification (P1-07)', () => {
  let leaveRequestsRepo: any;
  let service: LeaveService;

  beforeEach(() => {
    leaveRequestsRepo = {
      findByEmployee: jest.fn().mockResolvedValue([]),
      findPendingApprovals: jest.fn().mockResolvedValue([]),
    };
    service = new LeaveService(
      {} as any,
      leaveRequestsRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('getEmployeeLeaveRequests (backing GET requests, self-only): succeeds for your own id', async () => {
    const ctx = makeContext({ employeeId: 'self-employee-1', scope: SELF_SCOPE });
    await service.getEmployeeLeaveRequests(ctx, 'self-employee-1');
    expect(leaveRequestsRepo.findByEmployee).toHaveBeenCalledWith(
      ctx,
      'self-employee-1',
      expect.anything(),
    );
  });

  it('getEmployeeLeaveRequests: is genuinely scope-checked, not just incidentally self-safe — someone else\'s id 403s under self scope', async () => {
    const ctx = makeContext({ employeeId: 'self-employee-1', scope: SELF_SCOPE });
    await expect(service.getEmployeeLeaveRequests(ctx, 'someone-else')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('getPendingApprovals: filters by the caller\'s own user id as approver, not by management scope', async () => {
    const ctx = makeContext({ scope: SELF_SCOPE });
    await service.getPendingApprovals(ctx, ctx.userId);
    expect(leaveRequestsRepo.findPendingApprovals).toHaveBeenCalledWith(ctx, ctx.userId);
  });
});

/**
 * P1-08 — verification, not new implementation. getLeaveRequestById already
 * implements the resource-keyed fetch-then-assert pattern (no resolver class
 * needed): the request is visible to its owner, its assigned approver, or a
 * caller who both holds leave.approve and has the request's employee within
 * their management scope. Confirmed by reading the file; these tests are the
 * acceptance-criteria evidence.
 */
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

/**
 * P1-09 — the open question from the reconciled Tasks.md turned out to
 * already be answered by the existing code, once actually traced.
 * approveLeaveRequest does NOT use assertActingOnEmployee / manager_scopes
 * at all - it gates on leaveRequest.approver_id, a value fixed at request
 * creation time by resolveApproverUserId (src/common/approval/approval.util.ts),
 * which walks employee.manager_id -> that manager's user_id. That's the
 * direct line manager, full stop - no team/org scope concept involved, and
 * therefore already narrower than manager_scopes-based team read access
 * without any directOnly-style special case needed. The
 * resolveFallbackApproverUserId path (used when an employee has no
 * manager) deliberately requires scope.all, so even the fallback never
 * hands approval to an out-of-scope team Admin.
 *
 * No code change - this is the acceptance-criteria evidence that the
 * existing approver_id gate does what the open question was asking whether
 * something needed to do.
 */
describe('LeaveService.approveLeaveRequest — assigned-approver gate, not scope (P1-09)', () => {
  let leaveRequestsRepo: any;
  let leaveBalanceRepo: any;
  let employeesRepo: any;
  let auditService: any;
  let transactionService: any;
  let eventsService: any;
  let service: LeaveService;

  const leaveRequest = {
    id: 'request-1',
    employee_id: 'target-employee-1',
    leave_type_id: 'type-1',
    duration_days: 2,
    status: 'submitted',
    approver_id: 'assigned-manager-user-1',
  };

  beforeEach(() => {
    leaveRequestsRepo = {
      findById: jest.fn().mockResolvedValue(leaveRequest),
      update: jest.fn().mockResolvedValue({ ...leaveRequest, status: 'approved' }),
    };
    leaveBalanceRepo = {
      findByEmployeeAndType: jest.fn().mockResolvedValue(null),
    };
    employeesRepo = {
      findById: jest.fn().mockResolvedValue({ id: 'target-employee-1', user_id: 'requester-user-1' }),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    transactionService = { runInTransaction: jest.fn((cb: any) => cb({})) };
    eventsService = { emitNotification: jest.fn() };
    service = new LeaveService(
      {} as any,
      leaveRequestsRepo,
      leaveBalanceRepo,
      employeesRepo,
      {} as any,
      {} as any,
      auditService,
      transactionService,
      eventsService,
    );
  });

  it('throws NotFoundException before any approver check for a nonexistent request', async () => {
    leaveRequestsRepo.findById.mockResolvedValueOnce(undefined);
    await expect(
      service.approveLeaveRequest(makeContext(), 'missing', 'assigned-manager-user-1', { approve: true } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('the assigned approver can approve, with no scope on tenantContext at all', async () => {
    const ctx = makeContext({ scope: undefined });
    const result = await service.approveLeaveRequest(ctx, 'request-1', 'assigned-manager-user-1', {
      approve: true,
    } as any);
    expect(result.status).toBe('approved');
    expect(eventsService.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'requester-user-1', type: 'leave.decided', title: expect.stringContaining('approved') }),
    );
  });

  it('a caller with org-wide scope who is NOT the assigned approver still 403s — scope never overrides the assignment', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    await expect(
      service.approveLeaveRequest(ctx, 'request-1', 'someone-else-entirely', { approve: true } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(leaveRequestsRepo.update).not.toHaveBeenCalled();
  });

  it('a caller whose team scope would cover the employee, but who isn\'t the assigned approver, still 403s', async () => {
    // Proves this is genuinely independent of manager_scopes: being able to
    // read/act on the employee under team scope elsewhere doesn't grant
    // approval authority here.
    const ctx = makeContext({
      scope: { kind: 'team', employeeIds: new Set(['target-employee-1']) },
    });
    await expect(
      service.approveLeaveRequest(ctx, 'request-1', 'some-other-manager', { approve: true } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a request that is not in "submitted" status, even for the correct approver', async () => {
    leaveRequestsRepo.findById.mockResolvedValueOnce({ ...leaveRequest, status: 'approved' });
    await expect(
      service.approveLeaveRequest(makeContext(), 'request-1', 'assigned-manager-user-1', {
        approve: true,
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
