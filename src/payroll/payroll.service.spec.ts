import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { TenantContext, ORG_SCOPE } from '../database/tenant-context';

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
