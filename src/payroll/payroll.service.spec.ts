import { BadRequestException, ForbiddenException } from '@nestjs/common';
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

describe('PayrollService — approve/mark-paid locked to org scope (P1-13)', () => {
  let salarySlipRepository: any;
  let auditService: any;
  let service: PayrollService;

  const draftSlip = { id: 'slip-1', employee_id: 'target-employee-1', status: 'draft' };
  const approvedSlip = { id: 'slip-1', employee_id: 'target-employee-1', status: 'approved' };

  beforeEach(() => {
    salarySlipRepository = {
      findById: jest.fn(),
      update: jest.fn((_tc: any, _id: string, patch: any) => Promise.resolve({ ...draftSlip, ...patch })),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    service = new PayrollService({} as any, {} as any, salarySlipRepository, {} as any, {} as any, {} as any, auditService, {} as any);
  });

  describe('approveSalarySlip', () => {
    it('team scope, even with payroll.approve: 403s before the slip is even fetched', async () => {
      const ctx = makeContext({
        permissions: ['payroll.approve'],
        scope: { kind: 'team', employeeIds: new Set(['target-employee-1']) },
      });
      await expect(service.approveSalarySlip(ctx, 'slip-1')).rejects.toThrow(ForbiddenException);
      expect(salarySlipRepository.findById).not.toHaveBeenCalled();
    });

    it('self scope: 403s regardless of target', async () => {
      const ctx = makeContext({ permissions: ['payroll.approve'] });
      await expect(service.approveSalarySlip(ctx, 'slip-1')).rejects.toThrow(ForbiddenException);
    });

    it('org scope: succeeds for a draft slip', async () => {
      salarySlipRepository.findById.mockResolvedValue(draftSlip);
      const ctx = makeContext({ scope: ORG_SCOPE });
      const result = await service.approveSalarySlip(ctx, 'slip-1');
      expect(result.status).toBe('approved');
    });

    it('org scope: still enforces the draft-only business rule underneath', async () => {
      salarySlipRepository.findById.mockResolvedValue(approvedSlip);
      const ctx = makeContext({ scope: ORG_SCOPE });
      await expect(service.approveSalarySlip(ctx, 'slip-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('markSalarySlipAsPaid', () => {
    it('team scope, even with payroll.approve: 403s before the slip is even fetched', async () => {
      const ctx = makeContext({
        permissions: ['payroll.approve'],
        scope: { kind: 'team', employeeIds: new Set(['target-employee-1']) },
      });
      await expect(service.markSalarySlipAsPaid(ctx, 'slip-1')).rejects.toThrow(ForbiddenException);
      expect(salarySlipRepository.findById).not.toHaveBeenCalled();
    });

    it('org scope: succeeds for an approved slip', async () => {
      salarySlipRepository.findById.mockResolvedValue(approvedSlip);
      const ctx = makeContext({ scope: ORG_SCOPE });
      const result = await service.markSalarySlipAsPaid(ctx, 'slip-1');
      expect(result.status).toBe('paid');
    });
  });
});
