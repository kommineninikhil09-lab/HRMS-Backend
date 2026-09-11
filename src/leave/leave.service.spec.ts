import { ForbiddenException } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { TenantContext, SELF_SCOPE } from '../database/tenant-context';

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
