import { ESSService } from './ess.service';
import { TenantContext } from '../database/tenant-context';

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

describe('ESSService.updateProfile — transactional read-back', () => {
  let employeesRepository: any;
  let auditService: any;
  let transactionService: any;
  let service: ESSService;

  const employee = {
    id: 'self-employee-1',
    employee_code: 'E001',
    first_name: 'Jane',
    last_name: 'Doe',
    personal_email: 'old@example.com',
    phone: '111',
    dob: '1990-01-01',
    status: 'active',
  };

  const client = { marker: 'transaction-client' };

  beforeEach(() => {
    employeesRepository = {
      findById: jest.fn().mockResolvedValue(employee),
      update: jest.fn().mockResolvedValue({ ...employee, personal_email: 'new@example.com' }),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    transactionService = {
      runInTransaction: jest.fn((cb: any) => cb(client)),
    };
    service = new ESSService(employeesRepository, auditService, transactionService);
  });

  it('reads the post-update profile back through the same transaction client, not the pool', async () => {
    const ctx = makeContext();
    await service.updateProfile(ctx, employee.id, { personal_email: 'new@example.com' });

    // findById is called twice: once before the update (no executor - outside
    // the transaction) and once via getEmployeeProfile after (must reuse the
    // transaction client, otherwise the read can race the not-yet-committed write).
    expect(employeesRepository.findById).toHaveBeenCalledTimes(2);
    expect(employeesRepository.findById).toHaveBeenLastCalledWith(ctx, employee.id, client);
  });
});
