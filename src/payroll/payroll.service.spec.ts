import { ForbiddenException, NotFoundException } from '@nestjs/common';
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

describe('PayrollService — resource-keyed slip routes (P1-12)', () => {
  let salarySlipRepository: any;
  let slipComponentRepository: any;
  let service: PayrollService;

  const slip = { id: 'slip-1', employee_id: 'target-employee-1', status: 'draft' };

  beforeEach(() => {
    salarySlipRepository = { findById: jest.fn().mockResolvedValue(slip) };
    slipComponentRepository = { getSlipBreakdown: jest.fn().mockResolvedValue([]) };
    service = new PayrollService(
      {} as any,
      {} as any,
      salarySlipRepository,
      {} as any,
      {} as any,
      slipComponentRepository,
      {} as any,
      {} as any,
    );
  });

  describe('getSalarySlip', () => {
    it('throws NotFoundException before any scope check for a nonexistent slip', async () => {
      salarySlipRepository.findById.mockResolvedValueOnce(undefined);
      const ctx = makeContext({ scope: { kind: 'team', employeeIds: new Set() } });
      await expect(service.getSalarySlip(ctx, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('team scope: succeeds when the slip\'s employee is in scope, 403s otherwise', async () => {
      const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-employee-1']) } });
      await expect(service.getSalarySlip(ctxIn, 'slip-1')).resolves.toEqual(slip);

      const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
      await expect(service.getSalarySlip(ctxOut, 'slip-1')).rejects.toThrow(ForbiddenException);
    });

    it('org scope: succeeds regardless of whose slip it is', async () => {
      const ctx = makeContext({ scope: ORG_SCOPE });
      await expect(service.getSalarySlip(ctx, 'slip-1')).resolves.toEqual(slip);
    });
  });

  describe('getSlipWithBreakdown', () => {
    it('throws NotFoundException before any scope check for a nonexistent slip', async () => {
      salarySlipRepository.findById.mockResolvedValueOnce(undefined);
      const ctx = makeContext({ scope: { kind: 'team', employeeIds: new Set() } });
      await expect(service.getSlipWithBreakdown(ctx, 'missing')).rejects.toThrow(NotFoundException);
      expect(slipComponentRepository.getSlipBreakdown).not.toHaveBeenCalled();
    });

    it('team scope: succeeds for an in-scope slip owner, 403s for an out-of-scope one', async () => {
      const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-employee-1']) } });
      await expect(service.getSlipWithBreakdown(ctxIn, 'slip-1')).resolves.toEqual({
        ...slip,
        components: [],
      });

      const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
      await expect(service.getSlipWithBreakdown(ctxOut, 'slip-1')).rejects.toThrow(ForbiddenException);
      expect(slipComponentRepository.getSlipBreakdown).not.toHaveBeenCalledWith(ctxOut, 'slip-1');
    });
  });
});
