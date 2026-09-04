import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Pool } from 'pg';
import { ScopeService } from './scope.service';
import { EmployeesService } from '../../employees/employees.service';
import { POOL_PROVIDER } from '../../database/pool.provider';
import { TenantContext } from '../../database/tenant-context';

describe('ScopeService', () => {
  let service: ScopeService;
  let mockPool: jest.Mocked<Pool>;
  let mockEmployeesService: jest.Mocked<EmployeesService>;

  const tenantContext: TenantContext = {
    organizationId: 'org-1',
    userId: 'user-manager',
    requestId: 'req-1',
  };

  beforeEach(async () => {
    mockPool = { query: jest.fn() } as any;
    mockEmployeesService = {
      getByUserId: jest.fn(),
      getDirectReportIds: jest.fn(),
      getSubtreeIds: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScopeService,
        { provide: POOL_PROVIDER, useValue: mockPool },
        { provide: EmployeesService, useValue: mockEmployeesService },
      ],
    }).compile();

    service = module.get<ScopeService>(ScopeService);
  });

  describe('getEffectiveScope', () => {
    it('returns null when the user has no rows for the permission (no permission ⇒ deny)', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);
      const scope = await service.getEffectiveScope(tenantContext, 'employee.read');
      expect(scope).toBeNull();
    });

    it('returns SELF, TEAM, or ORGANIZATION as a single role dictates', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ scope: 'TEAM' }] } as any);
      expect(await service.getEffectiveScope(tenantContext, 'attendance.read')).toBe('TEAM');
    });

    it('returns the widest scope when the user holds multiple roles with different scopes', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ scope: 'SELF' }, { scope: 'ORGANIZATION' }, { scope: 'TEAM' }],
      } as any);
      expect(await service.getEffectiveScope(tenantContext, 'employee.read')).toBe('ORGANIZATION');
    });
  });

  describe('getSubordinateIds', () => {
    it('returns [] when the given user has no employee record', async () => {
      mockEmployeesService.getByUserId.mockResolvedValueOnce(undefined);
      const ids = await service.getSubordinateIds(tenantContext, 'user-manager');
      expect(ids).toEqual([]);
      expect(mockEmployeesService.getSubtreeIds).not.toHaveBeenCalled();
    });

    it('delegates to getSubtreeIds by default (TEAM = recursive subtree)', async () => {
      mockEmployeesService.getByUserId.mockResolvedValueOnce({ id: 'emp-manager' } as any);
      mockEmployeesService.getSubtreeIds.mockResolvedValueOnce(['emp-a', 'emp-b', 'emp-c']);
      const ids = await service.getSubordinateIds(tenantContext, 'user-manager');
      expect(mockEmployeesService.getSubtreeIds).toHaveBeenCalledWith(tenantContext, 'emp-manager');
      expect(mockEmployeesService.getDirectReportIds).not.toHaveBeenCalled();
      expect(ids).toEqual(['emp-a', 'emp-b', 'emp-c']);
    });

    it('delegates to getDirectReportIds when opts.direct is true (used by leave approval)', async () => {
      mockEmployeesService.getByUserId.mockResolvedValueOnce({ id: 'emp-manager' } as any);
      mockEmployeesService.getDirectReportIds.mockResolvedValueOnce(['emp-a']);
      const ids = await service.getSubordinateIds(tenantContext, 'user-manager', { direct: true });
      expect(mockEmployeesService.getDirectReportIds).toHaveBeenCalledWith(tenantContext, 'emp-manager');
      expect(mockEmployeesService.getSubtreeIds).not.toHaveBeenCalled();
      expect(ids).toEqual(['emp-a']);
    });

    it('returns [] for a manager with an empty team', async () => {
      mockEmployeesService.getByUserId.mockResolvedValueOnce({ id: 'emp-manager' } as any);
      mockEmployeesService.getSubtreeIds.mockResolvedValueOnce([]);
      const ids = await service.getSubordinateIds(tenantContext, 'user-manager');
      expect(ids).toEqual([]);
    });
  });

  describe('assertEmployeeInScope', () => {
    it('throws UnauthorizedException when the user has no permission at all', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);
      await expect(
        service.assertEmployeeInScope(tenantContext, 'employee.read', 'emp-target'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('allows ORGANIZATION scope against any target without an employee lookup', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ scope: 'ORGANIZATION' }] } as any);
      await expect(
        service.assertEmployeeInScope(tenantContext, 'employee.read', 'emp-anyone'),
      ).resolves.toBeUndefined();
      expect(mockEmployeesService.getByUserId).not.toHaveBeenCalled();
    });

    it('SELF scope: allows when the target is the caller themself', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ scope: 'SELF' }] } as any);
      mockEmployeesService.getByUserId.mockResolvedValueOnce({ id: 'emp-self' } as any);
      await expect(
        service.assertEmployeeInScope(tenantContext, 'employee.read', 'emp-self'),
      ).resolves.toBeUndefined();
    });

    it('SELF scope: denies (403) when the target is someone else', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ scope: 'SELF' }] } as any);
      mockEmployeesService.getByUserId.mockResolvedValueOnce({ id: 'emp-self' } as any);
      await expect(
        service.assertEmployeeInScope(tenantContext, 'employee.read', 'emp-other'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TEAM scope: allows a subtree report by default', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ scope: 'TEAM' }] } as any);
      mockEmployeesService.getByUserId.mockResolvedValueOnce({ id: 'emp-manager' } as any);
      mockEmployeesService.getSubtreeIds.mockResolvedValueOnce(['emp-direct', 'emp-deep']);
      await expect(
        service.assertEmployeeInScope(tenantContext, 'performance.review', 'emp-deep'),
      ).resolves.toBeUndefined();
    });

    it('TEAM scope: denies (403) a non-report', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ scope: 'TEAM' }] } as any);
      mockEmployeesService.getByUserId.mockResolvedValueOnce({ id: 'emp-manager' } as any);
      mockEmployeesService.getSubtreeIds.mockResolvedValueOnce(['emp-direct']);
      await expect(
        service.assertEmployeeInScope(tenantContext, 'attendance.read', 'emp-stranger'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TEAM scope with directOnly: denies a subtree-but-not-direct report (leave approval chain)', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ scope: 'TEAM' }] } as any);
      mockEmployeesService.getByUserId.mockResolvedValueOnce({ id: 'emp-manager' } as any);
      mockEmployeesService.getDirectReportIds.mockResolvedValueOnce(['emp-direct']);
      await expect(
        service.assertEmployeeInScope(tenantContext, 'leave.approve', 'emp-deep-report', { directOnly: true }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockEmployeesService.getDirectReportIds).toHaveBeenCalledWith(tenantContext, 'emp-manager');
      expect(mockEmployeesService.getSubtreeIds).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the caller has a permission but no linked employee record', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ scope: 'SELF' }] } as any);
      mockEmployeesService.getByUserId.mockResolvedValueOnce(undefined);
      await expect(
        service.assertEmployeeInScope(tenantContext, 'employee.read', 'emp-target'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getScopedEmployeeIds', () => {
    it('throws UnauthorizedException with no permission', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);
      await expect(service.getScopedEmployeeIds(tenantContext, 'payroll.read')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("returns 'ALL' for ORGANIZATION scope", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ scope: 'ORGANIZATION' }] } as any);
      const ids = await service.getScopedEmployeeIds(tenantContext, 'employee.read');
      expect(ids).toBe('ALL');
      expect(mockEmployeesService.getByUserId).not.toHaveBeenCalled();
    });

    it('returns [self] for SELF scope', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ scope: 'SELF' }] } as any);
      mockEmployeesService.getByUserId.mockResolvedValueOnce({ id: 'emp-self' } as any);
      const ids = await service.getScopedEmployeeIds(tenantContext, 'employee.read');
      expect(ids).toEqual(['emp-self']);
    });

    it('returns [self, ...team] for TEAM scope', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ scope: 'TEAM' }] } as any);
      mockEmployeesService.getByUserId.mockResolvedValueOnce({ id: 'emp-manager' } as any);
      mockEmployeesService.getSubtreeIds.mockResolvedValueOnce(['emp-a', 'emp-b']);
      const ids = await service.getScopedEmployeeIds(tenantContext, 'employee.read');
      expect(ids).toEqual(['emp-manager', 'emp-a', 'emp-b']);
    });
  });
});
