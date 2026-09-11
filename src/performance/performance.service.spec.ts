import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PerformanceService } from './performance.service';
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

describe('PerformanceService.getAppraisal — resource-keyed authorization (P1-14)', () => {
  let appraisalRepository: any;
  let service: PerformanceService;

  const appraisal = { id: 'appraisal-1', employee_id: 'target-employee-1', status: 'draft' };

  beforeEach(() => {
    appraisalRepository = { findById: jest.fn().mockResolvedValue(appraisal) };
    service = new PerformanceService(
      {} as any,
      {} as any,
      appraisalRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('throws NotFoundException before any scope check for a nonexistent appraisal', async () => {
    appraisalRepository.findById.mockResolvedValueOnce(undefined);
    const ctx = makeContext({ scope: { kind: 'team', employeeIds: new Set() } });
    await expect(service.getAppraisal(ctx, 'missing')).rejects.toThrow(NotFoundException);
  });

  it('team scope: succeeds for an in-scope target, 403s for an out-of-scope one', async () => {
    const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-employee-1']) } });
    await expect(service.getAppraisal(ctxIn, 'appraisal-1')).resolves.toEqual(appraisal);

    const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
    await expect(service.getAppraisal(ctxOut, 'appraisal-1')).rejects.toThrow(ForbiddenException);
  });

  it('org scope: succeeds regardless of whose appraisal it is', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    await expect(service.getAppraisal(ctx, 'appraisal-1')).resolves.toEqual(appraisal);
  });
});

describe('PerformanceService — goal routes scope-gating (P1-15)', () => {
  let goalRepository: any;
  let auditService: any;
  let service: PerformanceService;

  beforeEach(() => {
    goalRepository = {
      create: jest.fn().mockResolvedValue({ id: 'goal-1', employee_id: 'target-1' }),
      findByEmployee: jest.fn().mockResolvedValue([]),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    service = new PerformanceService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      goalRepository,
      auditService,
      {} as any,
    );
  });

  describe('createGoal (POST performance/goals, employee_id in body)', () => {
    it('self scope: creating a goal for yourself succeeds, for someone else 403s', async () => {
      const ctxSelf = makeContext({ employeeId: 'self-employee-1', scope: SELF_SCOPE });
      await expect(service.createGoal(ctxSelf, { employee_id: 'self-employee-1' })).resolves.toBeDefined();

      const ctxOther = makeContext({ employeeId: 'self-employee-1', scope: SELF_SCOPE });
      await expect(service.createGoal(ctxOther, { employee_id: 'someone-else' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(goalRepository.create).not.toHaveBeenCalledWith(
        ctxOther,
        expect.objectContaining({ employee_id: 'someone-else' }),
      );
    });

    it('team scope: creating a goal for an in-scope report succeeds, 403s for a non-report', async () => {
      const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-1']) } });
      await expect(service.createGoal(ctxIn, { employee_id: 'target-1' })).resolves.toBeDefined();

      const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['not-a-report']) } });
      await expect(service.createGoal(ctxOut, { employee_id: 'target-1' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('org scope: succeeds for any employee_id', async () => {
      const ctx = makeContext({ scope: ORG_SCOPE });
      await expect(service.createGoal(ctx, { employee_id: 'anyone' })).resolves.toBeDefined();
    });
  });

  describe('getEmployeeGoals (GET employee/:employeeId/goals)', () => {
    it('team scope: succeeds for an in-scope target, 403s for an out-of-scope one', async () => {
      const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-1']) } });
      await expect(service.getEmployeeGoals(ctxIn, 'target-1')).resolves.toEqual([]);

      const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
      await expect(service.getEmployeeGoals(ctxOut, 'target-1')).rejects.toThrow(ForbiddenException);
    });

    it('org scope: succeeds for any target', async () => {
      const ctx = makeContext({ scope: ORG_SCOPE });
      await expect(service.getEmployeeGoals(ctx, 'target-1')).resolves.toEqual([]);
    });
  });
});

describe('PerformanceService.getAppraisals — scope-filtering the list (P1-16)', () => {
  let appraisalRepository: any;
  let service: PerformanceService;

  beforeEach(() => {
    appraisalRepository = {
      findByCycle: jest.fn().mockResolvedValue([]),
      findByStatus: jest.fn().mockResolvedValue([]),
      findByEmployee: jest.fn().mockResolvedValue([]),
    };
    service = new PerformanceService(
      {} as any,
      {} as any,
      appraisalRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('cycle_id filter: passes scopedIds through, null for org scope', async () => {
    await service.getAppraisals(makeContext({ scope: ORG_SCOPE }), { cycle_id: 'cycle-1' });
    expect(appraisalRepository.findByCycle).toHaveBeenCalledWith(expect.anything(), 'cycle-1', null);
  });

  it('cycle_id filter: passes the resolved team set for team scope', async () => {
    await service.getAppraisals(
      makeContext({ scope: { kind: 'team', employeeIds: new Set(['report-1']) } }),
      { cycle_id: 'cycle-1' },
    );
    const call = appraisalRepository.findByCycle.mock.calls[0];
    expect(new Set(call[2])).toEqual(new Set(['report-1', 'self-employee-1']));
  });

  it('status filter: passes scopedIds through the same way', async () => {
    await service.getAppraisals(makeContext({ scope: ORG_SCOPE }), { status: 'submitted' });
    expect(appraisalRepository.findByStatus).toHaveBeenCalledWith(
      expect.anything(),
      'submitted',
      null,
    );
  });

  it('employee_id filter: scope-checks the specific employee instead of using scopedIds', async () => {
    const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-1']) } });
    await service.getAppraisals(ctxIn, { employee_id: 'target-1' });
    expect(appraisalRepository.findByEmployee).toHaveBeenCalledWith(ctxIn, 'target-1');

    const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
    await expect(service.getAppraisals(ctxOut, { employee_id: 'target-1' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('no filters: returns an empty list without querying anything (unchanged existing behavior)', async () => {
    const result = await service.getAppraisals(makeContext({ scope: ORG_SCOPE }), {});
    expect(result).toEqual([]);
    expect(appraisalRepository.findByCycle).not.toHaveBeenCalled();
    expect(appraisalRepository.findByStatus).not.toHaveBeenCalled();
  });
});
