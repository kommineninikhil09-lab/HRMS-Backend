import { Pool } from 'pg';
import { EmployeesRepository } from './employees.repository';
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

describe('EmployeesRepository.findAll — scope filtering (P1-02)', () => {
  let mockPool: jest.Mocked<Pool>;
  let repository: EmployeesRepository;

  beforeEach(() => {
    mockPool = { query: jest.fn().mockResolvedValue({ rows: [] }) } as any;
    repository = new EmployeesRepository(mockPool);
  });

  it('uses an explicit column list, never SELECT *', async () => {
    await repository.findAll(makeContext(), { scopedIds: null });
    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).not.toMatch(/select\s+\*/i);
    expect(sql).toMatch(/select\s+id,\s*employee_code/i);
  });

  it('omits the id filter entirely when scopedIds is null (org scope)', async () => {
    await repository.findAll(makeContext(), { scopedIds: null });
    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).not.toMatch(/id = any/i);
  });

  it('filters by id = ANY(...) when scopedIds is a real array', async () => {
    await repository.findAll(makeContext(), { scopedIds: ['emp-1', 'emp-2'] });
    const [sql, values] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/id = any\(\$\d+::uuid\[\]\)/i);
    expect(values).toContainEqual(['emp-1', 'emp-2']);
  });

  it('still applies status/department_id filters alongside the scope filter', async () => {
    await repository.findAll(makeContext(), {
      status: 'active',
      department_id: 'dept-1',
      scopedIds: ['emp-1'],
    });
    const [sql, values] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/status = \$\d+/i);
    expect(sql).toMatch(/department_id = \$\d+/i);
    expect(values).toEqual(['org-1', 'active', 'dept-1', ['emp-1']]);
  });
});
