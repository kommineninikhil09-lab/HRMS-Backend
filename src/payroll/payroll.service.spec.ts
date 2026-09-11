import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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

describe('PayrollService — approve/mark-paid locked to org scope (P1-13)', () => {
  let salarySlipRepository: any;
  let auditService: any;
  let service: PayrollService;

  // employeeId, not employee_id: SalarySlipRepository goes through
  // BaseRepository.query/queryOne, which camelCases every row.
  const draftSlip = { id: 'slip-1', employeeId: 'target-employee-1', status: 'draft' };
  const approvedSlip = { id: 'slip-1', employeeId: 'target-employee-1', status: 'approved' };

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

  // employeeId, not employee_id — see the comment on draftSlip above.
  const slip = { id: 'slip-1', employeeId: 'target-employee-1', status: 'draft' };

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

describe('PayrollService.assignStructureToEmployee — scope-gating', () => {
  let structureRepository: any;
  let assignmentRepository: any;
  let auditService: any;
  let service: PayrollService;

  beforeEach(() => {
    structureRepository = { findById: jest.fn().mockResolvedValue({ id: 'structure-1' }) };
    assignmentRepository = {
      create: jest.fn((_tc: any, data: any) => Promise.resolve({ id: 'assignment-1', ...data })),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    service = new PayrollService(
      structureRepository,
      {} as any,
      {} as any,
      assignmentRepository,
      {} as any,
      {} as any,
      auditService,
      {} as any,
    );
  });

  it('team scope: succeeds for an in-scope target, 403s for an out-of-scope one', async () => {
    const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set(['target-1']) } });
    await expect(
      service.assignStructureToEmployee(ctxIn, 'target-1', 'structure-1', '2026-01-01'),
    ).resolves.toBeDefined();

    const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
    await expect(
      service.assignStructureToEmployee(ctxOut, 'target-1', 'structure-1', '2026-01-01'),
    ).rejects.toThrow(ForbiddenException);
    expect(assignmentRepository.create).toHaveBeenCalledTimes(1);
  });

  it('org scope: succeeds for any target', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    await expect(
      service.assignStructureToEmployee(ctx, 'anyone', 'structure-1', '2026-01-01'),
    ).resolves.toBeDefined();
  });
});

describe('PayrollService — pending/approved slip listing scope-filtering', () => {
  let salarySlipRepository: any;
  let service: PayrollService;

  beforeEach(() => {
    salarySlipRepository = { findByStatus: jest.fn().mockResolvedValue([]) };
    service = new PayrollService(
      {} as any,
      {} as any,
      salarySlipRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('getPendingApprovals: org scope passes null (no filter), team scope passes the resolved set', async () => {
    await service.getPendingApprovals(makeContext({ scope: ORG_SCOPE }));
    expect(salarySlipRepository.findByStatus).toHaveBeenCalledWith(expect.anything(), 'draft', null);

    await service.getPendingApprovals(
      makeContext({ employeeId: 'self-employee-1', scope: { kind: 'team', employeeIds: new Set(['report-1']) } }),
    );
    const call = salarySlipRepository.findByStatus.mock.calls[1];
    expect(new Set(call[2])).toEqual(new Set(['report-1', 'self-employee-1']));
  });

  it('getApprovedSlips: same scoping behavior', async () => {
    await service.getApprovedSlips(makeContext({ scope: ORG_SCOPE }));
    expect(salarySlipRepository.findByStatus).toHaveBeenCalledWith(expect.anything(), 'approved', null);
  });
});

describe('PayrollService.generateSalarySlip — amount computation and persistence', () => {
  let salarySlipRepository: any;
  let assignmentRepository: any;
  let structureComponentRepository: any;
  let slipComponentRepository: any;
  let auditService: any;
  let transactionService: any;
  let service: PayrollService;

  beforeEach(() => {
    assignmentRepository = {
      findActiveByEmployee: jest.fn().mockResolvedValue({ structureId: 'structure-1' }),
    };
    // amount comes back as a string: numeric(14,2) columns are not parsed by
    // pg into JS numbers, so this mirrors what Postgres actually returns.
    structureComponentRepository = {
      findByStructure: jest.fn().mockResolvedValue([
        { componentId: 'c-earn', componentName: 'Base', componentType: 'earnings', amount: '5000.00' },
        { componentId: 'c-ded', componentName: 'Tax', componentType: 'deduction', amount: '1200.50' },
      ]),
    };
    slipComponentRepository = { addComponentToSlip: jest.fn().mockResolvedValue(undefined) };
    salarySlipRepository = {
      create: jest.fn((_tc: any, data: any) => Promise.resolve({ id: 'slip-1', ...data })),
      update: jest.fn((_tc: any, id: string, patch: any) => Promise.resolve({ id, ...patch })),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    transactionService = { runInTransaction: jest.fn((cb: any) => cb({})) };
    service = new PayrollService(
      {} as any,
      {} as any,
      salarySlipRepository,
      assignmentRepository,
      structureComponentRepository,
      slipComponentRepository,
      auditService,
      transactionService,
    );
  });

  it('sums string numeric amounts correctly instead of concatenating, and persists them', async () => {
    const result: any = await service.generateSalarySlip(
      makeContext({ scope: ORG_SCOPE }),
      'employee-1',
      '2026-01',
      'cycle-1',
    );

    expect(salarySlipRepository.update).toHaveBeenCalledWith(
      expect.anything(),
      'slip-1',
      { gross_amount: 5000, total_deductions: 1200.5, net_amount: 3799.5 },
      expect.anything(),
    );
    expect(result.gross_amount).toBe(5000);
    expect(result.total_deductions).toBe(1200.5);
    expect(result.net_amount).toBe(3799.5);
  });
});
