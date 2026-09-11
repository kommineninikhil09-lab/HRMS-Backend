import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PerformanceService } from './performance.service';
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
