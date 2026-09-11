import { ForbiddenException } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { TenantContext, ORG_SCOPE, SELF_SCOPE } from '../database/tenant-context';

/**
 * P1-10 — verification, not new implementation. Both getLeaveBalance
 * (backing GET balance/employee/:employeeId) and getEmployeeLeaveRequests
 * (backing GET employee/:employeeId/requests) already call
 * assertActingOnEmployee(tenantContext, employeeId) as their first line —
 * confirmed by reading leave.service.ts. These tests are the
 * acceptance-criteria evidence for that, not a retrofit.
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
