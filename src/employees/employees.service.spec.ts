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
