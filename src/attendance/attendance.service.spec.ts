import { ForbiddenException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { TenantContext, ORG_SCOPE, SELF_SCOPE } from '../database/tenant-context';

/**
 * P1-06 — verification, not new implementation. AttendanceService.markAttendance
 * already calls assertActingOnEmployee(tenantContext, dto.employee_id) before
 * doing anything else (confirmed by reading the file). These tests are the
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
