import { Pool } from 'pg';
import { PerformanceAppraisalRepository } from './performance-appraisal.repository';
import { TenantContext } from '../../database/tenant-context';

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

describe('PerformanceAppraisalRepository — scope filtering in list queries (P1-16)', () => {
  let mockPool: jest.Mocked<Pool>;
  let repository: PerformanceAppraisalRepository;

  beforeEach(() => {
    mockPool = { query: jest.fn().mockResolvedValue({ rows: [] }) } as any;
    repository = new PerformanceAppraisalRepository(mockPool);
  });

  describe('findByCycle', () => {
    it('omits the employee_id filter when scopedIds is null (org scope)', async () => {
      await repository.findByCycle(makeContext(), 'cycle-1', null);
      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).not.toMatch(/employee_id = any/i);
    });

    it('filters by employee_id = ANY(...) when scopedIds is a real array', async () => {
      await repository.findByCycle(makeContext(), 'cycle-1', ['emp-1', 'emp-2']);
      const [sql, values] = mockPool.query.mock.calls[0];
      expect(sql).toMatch(/employee_id = any\(\$\d+::uuid\[\]\)/i);
      expect(values).toContainEqual(['emp-1', 'emp-2']);
    });
  });

  describe('findByStatus', () => {
    it('omits the employee_id filter when scopedIds is null (org scope)', async () => {
      await repository.findByStatus(makeContext(), 'submitted', null);
      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).not.toMatch(/employee_id = any/i);
    });

    it('filters by employee_id = ANY(...) when scopedIds is a real array', async () => {
      await repository.findByStatus(makeContext(), 'submitted', ['emp-1']);
      const [sql, values] = mockPool.query.mock.calls[0];
      expect(sql).toMatch(/employee_id = any\(\$\d+::uuid\[\]\)/i);
      expect(values).toContainEqual(['emp-1']);
    });
  });
});
