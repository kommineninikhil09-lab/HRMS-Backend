import { ForbiddenException } from '@nestjs/common';
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
