import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
