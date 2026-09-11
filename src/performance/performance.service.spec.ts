import { ForbiddenException } from '@nestjs/common';
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
