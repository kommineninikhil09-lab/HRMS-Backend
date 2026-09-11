import { ForbiddenException } from '@nestjs/common';
import { PayrollService } from './payroll.service';
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

describe('PayrollService — employee-keyed routes scope-gating (P1-11)', () => {
  let salarySlipRepository: any;
  let assignmentRepository: any;
  let service: PayrollService;

  beforeEach(() => {
    salarySlipRepository = { findByEmployeeAndYear: jest.fn().mockResolvedValue([]) };
    assignmentRepository = {
      findActiveByEmployee: jest.fn().mockResolvedValue(null),
      findByEmployee: jest.fn().mockResolvedValue([]),
    };
    service = new PayrollService(
      {} as any,
      {} as any,
      salarySlipRepository,
      assignmentRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  describe('getEmployeeSalarySlips', () => {
    it('self scope: succeeds for your own id, 403s for anyone else', async () => {
      const ctxSelf = makeContext({ employeeId: 'self-employee-1', scope: SELF_SCOPE });
      await expect(service.getEmployeeSalarySlips(ctxSelf, 'self-employee-1')).resolves.toEqual([]);

      const ctxOther = makeContext({ employeeId: 'self-employee-1', scope: SELF_SCOPE });
      await expect(service.getEmployeeSalarySlips(ctxOther, 'someone-else')).rejects.toThrow(
        ForbiddenException,
      );
      expect(salarySlipRepository.findByEmployeeAndYear).not.toHaveBeenCalledWith(
        ctxOther,
        'someone-else',
        expect.anything(),
      );
    });

    it('org scope: succeeds for any id', async () => {
      const ctx = makeContext({ scope: ORG_SCOPE });
      await expect(service.getEmployeeSalarySlips(ctx, 'someone-else')).resolves.toEqual([]);
    });
  });

  describe('getEmployeeSalaryAssignment', () => {
    it('team scope: succeeds for an in-scope target, 403s for an out-of-scope one', async () => {
      const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-1']) } });
      await expect(service.getEmployeeSalaryAssignment(ctxIn, 'target-1')).resolves.toBeNull();

      const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
      await expect(service.getEmployeeSalaryAssignment(ctxOut, 'target-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getEmployeeAssignmentHistory', () => {
    it('team scope: succeeds for an in-scope target, 403s for an out-of-scope one', async () => {
      const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-1']) } });
      await expect(service.getEmployeeAssignmentHistory(ctxIn, 'target-1')).resolves.toEqual([]);

      const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
      await expect(service.getEmployeeAssignmentHistory(ctxOut, 'target-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('org scope: succeeds for any target', async () => {
      const ctx = makeContext({ scope: ORG_SCOPE });
      await expect(service.getEmployeeAssignmentHistory(ctx, 'target-1')).resolves.toEqual([]);
    });
  });
});
