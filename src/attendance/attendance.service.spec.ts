import { ForbiddenException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { TenantContext, ORG_SCOPE, SELF_SCOPE } from '../database/tenant-context';

/**
 * P1-05/P1-06 — verification, not new implementation. AttendanceService
 * already calls assertActingOnEmployee in adminEmployeeHistory/
 * adminEmployeeSummary/markAttendance (confirmed by reading the file), and
 * the self-derived routes (checkIn/checkOut/getToday/getHistory/getSummary,
 * all resolving the employee id from tenantContext via requireEmployeeId at
 * the controller, never from a request parameter) never call it at all —
 * there's no other employee id to check against. These tests are the
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

describe('AttendanceService — admin routes are scope-gated (P1-05)', () => {
  let service: AttendanceService;

  beforeEach(() => {
    // Only assertActingOnEmployee's placement is under test here — getHistory
    // and getSummary are spied out so the day-view-building pipeline (which
    // needs holidays/leave/timezone repositories) never has to run.
    service = new AttendanceService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(service, 'getHistory').mockResolvedValue([] as any);
    jest.spyOn(service, 'getSummary').mockResolvedValue({} as any);
  });

  describe('adminEmployeeHistory (GET admin/:employeeId)', () => {
    it('org scope: reaches any target', async () => {
      const ctx = makeContext({ scope: ORG_SCOPE });
      await expect(service.adminEmployeeHistory(ctx, 'target-1', {} as any)).resolves.toEqual([]);
    });

    it('team scope: reaches an in-scope target, 403s on an out-of-scope one', async () => {
      const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-1']) } });
      await expect(service.adminEmployeeHistory(ctxIn, 'target-1', {} as any)).resolves.toEqual([]);

      const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
      expect(() => service.adminEmployeeHistory(ctxOut, 'target-1', {} as any)).toThrow(ForbiddenException);
    });

    it('self scope: 403s on anyone other than yourself', () => {
      const ctx = makeContext({ employeeId: 'someone-else', scope: SELF_SCOPE });
      expect(() => service.adminEmployeeHistory(ctx, 'target-1', {} as any)).toThrow(ForbiddenException);
    });
  });

  describe('adminEmployeeSummary (GET admin/:employeeId/summary)', () => {
    it('team scope: reaches an in-scope target, 403s on an out-of-scope one', async () => {
      const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-1']) } });
      await expect(service.adminEmployeeSummary(ctxIn, 'target-1', {} as any)).resolves.toEqual({});

      const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
      expect(() => service.adminEmployeeSummary(ctxOut, 'target-1', {} as any)).toThrow(ForbiddenException);
    });

    it('org scope: reaches any target', async () => {
      const ctx = makeContext({ scope: ORG_SCOPE });
      await expect(service.adminEmployeeSummary(ctx, 'target-1', {} as any)).resolves.toEqual({});
    });
  });
});

describe('AttendanceService — self-derived routes never scope-check (P1-05)', () => {
  let service: AttendanceService;
  let employeesRepository: any;

  beforeEach(() => {
    employeesRepository = { findById: jest.fn().mockResolvedValue({ id: 'self-employee-1' }) };
    service = new AttendanceService(
      {
        findByDate: jest.fn().mockResolvedValue(null),
        findByDateRange: jest.fn().mockResolvedValue([]),
        getOrganizationTimezone: jest.fn().mockResolvedValue('UTC'),
      } as any,
      employeesRepository,
      { findApprovedForEmployeeInRange: jest.fn().mockResolvedValue([]) } as any,
      { findByOrg: jest.fn().mockResolvedValue([]) } as any,
      {} as any,
      {} as any,
    );
  });

  it('getToday succeeds under self scope, acting on your own employee id, with no scope error', async () => {
    const ctx = makeContext({ employeeId: 'self-employee-1', scope: SELF_SCOPE });
    await expect(service.getToday(ctx, 'self-employee-1')).resolves.toBeDefined();
  });
});

describe('AttendanceService.markAttendance — scope-gated by employee_id in the body (P1-06)', () => {
  let employeesRepository: any;
  let repository: any;
  let transactionService: any;
  let auditService: any;
  let service: AttendanceService;

  const dto = { employee_id: 'target-1', attendance_date: '2030-01-15', status: 'present' } as any;

  beforeEach(() => {
    employeesRepository = { findById: jest.fn().mockResolvedValue({ id: 'target-1' }) };
    repository = {
      findByDate: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'record-1', ...dto }),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    transactionService = { runInTransaction: jest.fn((cb: any) => cb({})) };
    service = new AttendanceService(
      repository,
      employeesRepository,
      {} as any,
      {} as any,
      auditService,
      transactionService,
    );
  });

  it('team scope: an in-scope employee_id succeeds', async () => {
    const ctx = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-1']) } });
    await expect(service.markAttendance(ctx, dto, 'marker-1')).resolves.toBeDefined();
    expect(transactionService.runInTransaction).toHaveBeenCalled();
  });

  it('team scope: an out-of-scope employee_id 403s before the transaction runs', async () => {
    const ctx = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
    await expect(service.markAttendance(ctx, dto, 'marker-1')).rejects.toThrow(ForbiddenException);
    expect(transactionService.runInTransaction).not.toHaveBeenCalled();
  });

  it('self scope: 403s when marking someone other than yourself', async () => {
    const ctx = makeContext({ employeeId: 'someone-else', scope: SELF_SCOPE });
    await expect(service.markAttendance(ctx, dto, 'marker-1')).rejects.toThrow(ForbiddenException);
  });

  it('org scope: succeeds for any employee_id', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    await expect(service.markAttendance(ctx, dto, 'marker-1')).resolves.toBeDefined();
  });
});
