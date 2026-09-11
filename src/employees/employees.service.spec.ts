import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
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

describe('EmployeesService — scope gating (P1-01)', () => {
  let repository: any;
  let historyRepository: any;
  let auditService: any;
  let transactionService: any;
  let service: EmployeesService;

  const targetEmployee = { id: 'target-employee-1', work_email: 'target@dev-org.local', status: 'active' };

  beforeEach(() => {
    repository = {
      findById: jest.fn().mockResolvedValue(targetEmployee),
      findByEmail: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ ...targetEmployee, status: 'inactive' }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    historyRepository = { record: jest.fn().mockResolvedValue(undefined) };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    transactionService = {
      runInTransaction: jest.fn((cb: any) => cb({})),
    };
    service = new EmployeesService(repository, historyRepository, auditService, transactionService);
  });

  describe('getById', () => {
    it('throws NotFoundException before any scope check for a nonexistent id', async () => {
      repository.findById.mockResolvedValueOnce(null);
      const ctx = makeContext({ scope: SELF_SCOPE });
      await expect(service.getById(ctx, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('org scope: succeeds for any target', async () => {
      const ctx = makeContext({ scope: ORG_SCOPE });
      await expect(service.getById(ctx, targetEmployee.id)).resolves.toEqual(targetEmployee);
    });

    it('self scope: succeeds for your own id, throws ForbiddenException for anyone else', async () => {
      const ctxSelf = makeContext({ employeeId: targetEmployee.id, scope: SELF_SCOPE });
      await expect(service.getById(ctxSelf, targetEmployee.id)).resolves.toEqual(targetEmployee);

      const ctxOther = makeContext({ employeeId: 'someone-else', scope: SELF_SCOPE });
      await expect(service.getById(ctxOther, targetEmployee.id)).rejects.toThrow(ForbiddenException);
    });

    it('team scope: succeeds for a target in the resolved set, 403s for one outside it', async () => {
      const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set([targetEmployee.id]) } });
      await expect(service.getById(ctxIn, targetEmployee.id)).resolves.toEqual(targetEmployee);

      const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
      await expect(service.getById(ctxOut, targetEmployee.id)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException before any scope check for a nonexistent id', async () => {
      repository.findById.mockResolvedValueOnce(null);
      const ctx = makeContext({ scope: SELF_SCOPE });
      await expect(service.update(ctx, 'missing', {})).rejects.toThrow(NotFoundException);
    });

    it('self scope: 403s on an out-of-scope target before touching the repository update', async () => {
      const ctx = makeContext({ employeeId: 'someone-else', scope: SELF_SCOPE });
      await expect(service.update(ctx, targetEmployee.id, { first_name: 'X' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('org scope: succeeds and calls through to the repository', async () => {
      const ctx = makeContext({ scope: ORG_SCOPE });
      await expect(service.update(ctx, targetEmployee.id, { status: 'inactive' })).resolves.toBeDefined();
      expect(repository.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('throws NotFoundException before any scope check for a nonexistent id', async () => {
      repository.findById.mockResolvedValueOnce(null);
      const ctx = makeContext({ scope: SELF_SCOPE });
      await expect(service.delete(ctx, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('team scope: 403s on an out-of-scope target before touching the repository delete', async () => {
      const ctx = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
      await expect(service.delete(ctx, targetEmployee.id)).rejects.toThrow(ForbiddenException);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('org scope: succeeds and calls through to the repository', async () => {
      const ctx = makeContext({ scope: ORG_SCOPE });
      await service.delete(ctx, targetEmployee.id);
      expect(repository.delete).toHaveBeenCalled();
    });
  });
});

describe('EmployeesService.getAll — scope filtering (P1-02)', () => {
  let repository: any;
  let service: EmployeesService;

  beforeEach(() => {
    repository = { findAll: jest.fn().mockResolvedValue([]) };
    service = new EmployeesService(repository, {} as any, {} as any, {} as any);
  });

  it('org scope: passes scopedIds: null through to the repository (no filter)', async () => {
    await service.getAll(makeContext({ scope: ORG_SCOPE }), { status: 'active' });
    expect(repository.findAll).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'active', scopedIds: null }),
    );
  });

  it('self scope: passes just the caller\'s own id', async () => {
    await service.getAll(makeContext({ employeeId: 'self-employee-1', scope: SELF_SCOPE }));
    expect(repository.findAll).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scopedIds: ['self-employee-1'] }),
    );
  });

  it('team scope: passes the resolved set plus the caller, deduplicated', async () => {
    await service.getAll(
      makeContext({
        employeeId: 'self-employee-1',
        scope: { kind: 'team', employeeIds: new Set(['report-1', 'self-employee-1']) },
      }),
    );
    const call = repository.findAll.mock.calls[0][1];
    expect(new Set(call.scopedIds)).toEqual(new Set(['report-1', 'self-employee-1']));
  });
});

describe('EmployeesService.getSensitive (P1-03)', () => {
  let repository: any;
  let service: EmployeesService;

  const targetEmployee = { id: 'target-employee-1', work_email: 'target@dev-org.local', status: 'active' };
  const sensitiveRow = { bank_account_number: '123456789', base_salary: '50000' };

  beforeEach(() => {
    repository = {
      findById: jest.fn().mockResolvedValue(targetEmployee),
      findSensitiveFields: jest.fn().mockResolvedValue(sensitiveRow),
    };
    service = new EmployeesService(repository, {} as any, {} as any, {} as any);
  });

  it('throws NotFoundException before any scope check for a nonexistent id', async () => {
    repository.findById.mockResolvedValueOnce(undefined);
    const ctx = makeContext({ scope: SELF_SCOPE });
    await expect(service.getSensitive(ctx, 'missing')).rejects.toThrow(NotFoundException);
    expect(repository.findSensitiveFields).not.toHaveBeenCalled();
  });

  it('self scope: 403s for anyone other than yourself, even the target existing', async () => {
    const ctx = makeContext({ employeeId: 'someone-else', scope: SELF_SCOPE });
    await expect(service.getSensitive(ctx, targetEmployee.id)).rejects.toThrow(ForbiddenException);
    expect(repository.findSensitiveFields).not.toHaveBeenCalled();
  });

  it('org scope: returns the restricted fields for any target', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    await expect(service.getSensitive(ctx, targetEmployee.id)).resolves.toEqual(sensitiveRow);
  });

  it('team scope: succeeds for a target in the resolved set, 403s for one outside it', async () => {
    const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set([targetEmployee.id]) } });
    await expect(service.getSensitive(ctxIn, targetEmployee.id)).resolves.toEqual(sensitiveRow);

    const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
    await expect(service.getSensitive(ctxOut, targetEmployee.id)).rejects.toThrow(ForbiddenException);
  });

  it('returns null, not an error, when the employee has no profile row yet', async () => {
    repository.findSensitiveFields.mockResolvedValueOnce(undefined);
    const ctx = makeContext({ scope: ORG_SCOPE });
    await expect(service.getSensitive(ctx, targetEmployee.id)).resolves.toBeNull();
  });
});

describe('EmployeesService.getEmploymentHistory (P3-01)', () => {
  let repository: any;
  let historyRepository: any;
  let service: EmployeesService;

  const targetEmployee = { id: 'target-employee-1', work_email: 'target@dev-org.local', status: 'active' };
  const historyRows = [
    { id: 'h-1', employee_id: 'target-employee-1', event_type: 'joining', effective_date: '2024-01-01' },
  ];

  beforeEach(() => {
    repository = { findById: jest.fn().mockResolvedValue(targetEmployee) };
    historyRepository = { getByEmployee: jest.fn().mockResolvedValue(historyRows) };
    service = new EmployeesService(repository, historyRepository, {} as any, {} as any);
  });

  it('throws NotFoundException before any scope check for a nonexistent id', async () => {
    repository.findById.mockResolvedValueOnce(undefined);
    const ctx = makeContext({ scope: SELF_SCOPE });
    await expect(service.getEmploymentHistory(ctx, 'missing')).rejects.toThrow(NotFoundException);
    expect(historyRepository.getByEmployee).not.toHaveBeenCalled();
  });

  it('self scope: succeeds for your own id, 403s for anyone else', async () => {
    const ctxSelf = makeContext({ employeeId: targetEmployee.id, scope: SELF_SCOPE });
    await expect(service.getEmploymentHistory(ctxSelf, targetEmployee.id)).resolves.toEqual(historyRows);

    const ctxOther = makeContext({ employeeId: 'someone-else', scope: SELF_SCOPE });
    await expect(service.getEmploymentHistory(ctxOther, targetEmployee.id)).rejects.toThrow(ForbiddenException);
    expect(historyRepository.getByEmployee).not.toHaveBeenCalledWith(ctxOther, targetEmployee.id);
  });

  it('team scope: succeeds for a target in the resolved set, 403s for one outside it', async () => {
    const ctxIn = makeContext({ scope: { kind: 'team', employeeIds: new Set([targetEmployee.id]) } });
    await expect(service.getEmploymentHistory(ctxIn, targetEmployee.id)).resolves.toEqual(historyRows);

    const ctxOut = makeContext({ scope: { kind: 'team', employeeIds: new Set(['someone-else']) } });
    await expect(service.getEmploymentHistory(ctxOut, targetEmployee.id)).rejects.toThrow(ForbiddenException);
  });

  it('org scope: succeeds for any target', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    await expect(service.getEmploymentHistory(ctx, targetEmployee.id)).resolves.toEqual(historyRows);
  });
});

describe('EmployeesService.update — manager cycle guard', () => {
  let repository: any;
  let historyRepository: any;
  let auditService: any;
  let transactionService: any;
  let service: EmployeesService;

  const employees: Record<string, any> = {
    'emp-a': { id: 'emp-a', manager_id: 'emp-b', status: 'active' },
    'emp-b': { id: 'emp-b', manager_id: 'emp-c', status: 'active' },
    'emp-c': { id: 'emp-c', manager_id: null, status: 'active' },
  };

  beforeEach(() => {
    repository = {
      findById: jest.fn((_ctx: any, id: string) => Promise.resolve(employees[id])),
      findByEmail: jest.fn().mockResolvedValue(null),
      update: jest.fn((_ctx: any, id: string, dto: any) => Promise.resolve({ ...employees[id], ...dto })),
    };
    historyRepository = { record: jest.fn().mockResolvedValue(undefined) };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    transactionService = { runInTransaction: jest.fn((cb: any) => cb({})) };
    service = new EmployeesService(repository, historyRepository, auditService, transactionService);
  });

  it('rejects setting an employee as their own manager', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    await expect(service.update(ctx, 'emp-a', { manager_id: 'emp-a' })).rejects.toThrow(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects a manager change that would create a transitive reporting cycle', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    // emp-a reports to emp-b reports to emp-c today; making emp-c report to
    // emp-a would close the loop.
    await expect(service.update(ctx, 'emp-c', { manager_id: 'emp-a' })).rejects.toThrow(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('allows a manager change that does not create a cycle', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    employees['emp-d'] = { id: 'emp-d', manager_id: null, status: 'active' };
    await expect(service.update(ctx, 'emp-a', { manager_id: 'emp-d' })).resolves.toBeDefined();
    expect(repository.update).toHaveBeenCalled();
  });

  it('skips the check entirely when manager_id is unchanged or absent', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    await service.update(ctx, 'emp-a', { manager_id: 'emp-b' });
    expect(repository.update).toHaveBeenCalled();
  });
});
