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
