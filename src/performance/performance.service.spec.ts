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

  // employeeId, not employee_id: PerformanceAppraisalRepository goes
  // through BaseRepository.query/queryOne, which camelCases every row.
  const appraisal = { id: 'appraisal-1', employeeId: 'target-employee-1', status: 'draft' };

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

/**
 * P1-17 — unlike P1-09's leave-approval question, this one turned out to be
 * a real, live gap rather than an already-solved design. reviewAppraisal
 * had no scope check at all (not even the standard assertActingOnEmployee
 * every other employee-keyed route in this module uses) - performance.review
 * is granted to Admin, whose scope depends entirely on their manager_scopes
 * assignment, so any Admin holding it could review any employee's appraisal
 * org-wide. finalizeAppraisal had the identical gap, found alongside while
 * checking review. Both now use the same standard check as
 * getAppraisal/createGoal/getEmployeeGoals - no directOnly-style narrowing,
 * since main's {kind:'team'} scope has no recursive-subtree concept to be
 * broad or narrow about in the first place.
 */
describe('PerformanceService — review/finalize scope-gating (P1-17)', () => {
  let appraisalRepository: any;
  let service: PerformanceService;

  const appraisal = {
    id: 'appraisal-1',
    employeeId: 'target-employee-1',
    status: 'submitted',
  };

  let auditService: any;

  beforeEach(() => {
    appraisalRepository = {
      findById: jest.fn().mockResolvedValue(appraisal),
      update: jest.fn((_tc: any, _id: string, patch: any) => Promise.resolve({ ...appraisal, ...patch })),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    service = new PerformanceService(
      {} as any,
      {} as any,
      appraisalRepository,
      {} as any,
      {} as any,
      {} as any,
      auditService,
      {} as any,
    );
  });

  describe('reviewAppraisal', () => {
    it('throws NotFoundException before any scope check for a nonexistent appraisal', async () => {
      appraisalRepository.findById.mockResolvedValueOnce(undefined);
      await expect(
        service.reviewAppraisal(makeContext({ scope: ORG_SCOPE }), 'missing', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('team scope: succeeds for an in-scope target, 403s for an out-of-scope one', async () => {
      const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-employee-1']) } });
      await expect(service.reviewAppraisal(ctxIn, 'appraisal-1', {})).resolves.toBeDefined();

      const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
      await expect(service.reviewAppraisal(ctxOut, 'appraisal-1', {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('org scope: succeeds regardless of whose appraisal it is', async () => {
      const ctx = makeContext({ scope: ORG_SCOPE });
      await expect(service.reviewAppraisal(ctx, 'appraisal-1', {})).resolves.toBeDefined();
    });
  });

  describe('finalizeAppraisal', () => {
    const reviewedAppraisal = { ...appraisal, status: 'reviewed' };

    beforeEach(() => {
      appraisalRepository.findById.mockResolvedValue(reviewedAppraisal);
    });

    it('team scope: succeeds for an in-scope target, 403s for an out-of-scope one', async () => {
      const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-employee-1']) } });
      await expect(service.finalizeAppraisal(ctxIn, 'appraisal-1')).resolves.toBeDefined();

      const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
      await expect(service.finalizeAppraisal(ctxOut, 'appraisal-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});

describe('PerformanceService.createAppraisal — scope-gating', () => {
  let cycleRepository: any;
  let templateRepository: any;
  let appraisalRepository: any;
  let service: PerformanceService;

  beforeEach(() => {
    cycleRepository = { findById: jest.fn().mockResolvedValue({ id: 'cycle-1' }) };
    templateRepository = { findById: jest.fn().mockResolvedValue({ id: 'template-1' }) };
    appraisalRepository = {
      create: jest.fn((_tc: any, data: any) => Promise.resolve({ id: 'appraisal-1', ...data })),
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    service = new PerformanceService(
      cycleRepository,
      templateRepository,
      appraisalRepository,
      {} as any,
      {} as any,
      {} as any,
      auditService,
      {} as any,
    );
  });

  it('self scope: creating an appraisal for yourself succeeds, for someone else 403s', async () => {
    const ctxSelf = makeContext({ employeeId: 'self-employee-1', scope: SELF_SCOPE });
    await expect(
      service.createAppraisal(ctxSelf, { cycle_id: 'cycle-1', template_id: 'template-1', employee_id: 'self-employee-1' }),
    ).resolves.toBeDefined();

    const ctxOther = makeContext({ employeeId: 'self-employee-1', scope: SELF_SCOPE });
    await expect(
      service.createAppraisal(ctxOther, { cycle_id: 'cycle-1', template_id: 'template-1', employee_id: 'someone-else' }),
    ).rejects.toThrow(ForbiddenException);
    expect(appraisalRepository.create).not.toHaveBeenCalledWith(
      ctxOther,
      expect.objectContaining({ employee_id: 'someone-else' }),
    );
  });

  it('team scope: succeeds for an in-scope target, 403s for a non-report', async () => {
    const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-1']) } });
    await expect(
      service.createAppraisal(ctxIn, { cycle_id: 'cycle-1', template_id: 'template-1', employee_id: 'target-1' }),
    ).resolves.toBeDefined();

    const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['not-a-report']) } });
    await expect(
      service.createAppraisal(ctxOut, { cycle_id: 'cycle-1', template_id: 'template-1', employee_id: 'target-1' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('org scope: succeeds for any employee_id', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    await expect(
      service.createAppraisal(ctx, { cycle_id: 'cycle-1', template_id: 'template-1', employee_id: 'anyone' }),
    ).resolves.toBeDefined();
  });
});

describe('PerformanceService.submitAppraisal — scope-gating', () => {
  let appraisalRepository: any;
  let service: PerformanceService;

  const draftAppraisal = { id: 'appraisal-1', employeeId: 'target-employee-1', status: 'draft' };

  beforeEach(() => {
    appraisalRepository = {
      findById: jest.fn().mockResolvedValue(draftAppraisal),
      update: jest.fn((_tc: any, _id: string, patch: any) => Promise.resolve({ ...draftAppraisal, ...patch })),
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    service = new PerformanceService(
      {} as any,
      {} as any,
      appraisalRepository,
      {} as any,
      {} as any,
      {} as any,
      auditService,
      {} as any,
    );
  });

  it('throws NotFoundException before any scope check for a nonexistent appraisal', async () => {
    appraisalRepository.findById.mockResolvedValueOnce(undefined);
    await expect(
      service.submitAppraisal(makeContext({ scope: ORG_SCOPE }), 'missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('team scope: succeeds for an in-scope target, 403s for an out-of-scope one', async () => {
    const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-employee-1']) } });
    await expect(service.submitAppraisal(ctxIn, 'appraisal-1')).resolves.toBeDefined();

    const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
    await expect(service.submitAppraisal(ctxOut, 'appraisal-1')).rejects.toThrow(ForbiddenException);
  });

  it('org scope: succeeds regardless of whose appraisal it is', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    await expect(service.submitAppraisal(ctx, 'appraisal-1')).resolves.toBeDefined();
  });
});

describe('PerformanceService.updateGoal — scope-gating', () => {
  let goalRepository: any;
  let service: PerformanceService;

  const goal = { id: 'goal-1', employeeId: 'target-employee-1', goal_title: 'Old title' };

  beforeEach(() => {
    goalRepository = {
      findById: jest.fn().mockResolvedValue(goal),
      update: jest.fn((_tc: any, _id: string, patch: any) => Promise.resolve({ ...goal, ...patch })),
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
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

  it('throws NotFoundException before any scope check for a nonexistent goal', async () => {
    goalRepository.findById.mockResolvedValueOnce(undefined);
    await expect(
      service.updateGoal(makeContext({ scope: ORG_SCOPE }), 'missing', {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('team scope: succeeds for an in-scope target, 403s for an out-of-scope one', async () => {
    const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-employee-1']) } });
    await expect(service.updateGoal(ctxIn, 'goal-1', { goal_title: 'New title' })).resolves.toBeDefined();

    const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
    await expect(service.updateGoal(ctxOut, 'goal-1', { goal_title: 'New title' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('org scope: succeeds regardless of whose goal it is', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    await expect(service.updateGoal(ctx, 'goal-1', { goal_title: 'New title' })).resolves.toBeDefined();
  });
});
