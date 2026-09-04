import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ScopeGuard } from './scope.guard';
import { ScopeService } from './scope.service';
import { SCOPE_PARAM_KEY } from './scope-param.decorator';
import { REQUIRE_SCOPE_KEY, RequireScopeMeta } from './require-scope.decorator';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TenantContext } from '../../database/tenant-context';

// ScopeGuard builds its own Reflector internally (it's a stateless wrapper
// around Reflect metadata, so that's safe to do — no DI needed for it) and
// resolves ScopeService lazily via `moduleRef.get()` on first use rather
// than as a constructor dependency (see scope.guard.ts's docstring for why:
// every declarative constructor-injection approach for ScopeService was
// verified broken against a live server). So these tests set real
// Reflect metadata directly on plain functions/classes, and mock only
// ModuleRef.
describe('ScopeGuard', () => {
  let guard: ScopeGuard;
  let mockScopeService: jest.Mocked<ScopeService>;
  let mockModuleRef: any;

  const tenantContext: TenantContext = { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' };

  function makeContext(overrides: {
    request?: any;
    permissions?: string[] | undefined;
    scopeParam?: string | undefined;
    requireScope?: RequireScopeMeta | undefined;
    isPublic?: boolean;
  }) {
    const request = overrides.request ?? { tenantContext, params: {}, body: {}, query: {} };
    const handler = function handler() {};
    const klass = class TestController {};

    if (overrides.permissions !== undefined) Reflect.defineMetadata(PERMISSIONS_KEY, overrides.permissions, handler);
    if (overrides.isPublic !== undefined) Reflect.defineMetadata(IS_PUBLIC_KEY, overrides.isPublic, handler);
    if (overrides.scopeParam !== undefined) Reflect.defineMetadata(SCOPE_PARAM_KEY, overrides.scopeParam, handler);
    if (overrides.requireScope !== undefined) Reflect.defineMetadata(REQUIRE_SCOPE_KEY, overrides.requireScope, handler);

    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => klass,
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    mockScopeService = {
      assertEmployeeInScope: jest.fn(),
      getScopedEmployeeIds: jest.fn(),
    } as any;
    mockModuleRef = {
      resolve: jest.fn().mockImplementation((token: any) => Promise.resolve(token === ScopeService ? mockScopeService : undefined)),
      get: jest.fn(),
    };

    guard = new ScopeGuard(mockModuleRef);
  });

  it('denies when there is no tenantContext on the request (JwtAuthGuard should have set it)', async () => {
    const ctx = makeContext({ request: { params: {} }, permissions: ['employee.read'] });
    await expect(guard.canActivate(ctx)).resolves.toBe(false);
  });

  it('allows a @Public() route even though it never gets a tenantContext (e.g. GET /health)', async () => {
    const ctx = makeContext({ request: { params: {} }, isPublic: true });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockScopeService.assertEmployeeInScope).not.toHaveBeenCalled();
    expect(mockScopeService.getScopedEmployeeIds).not.toHaveBeenCalled();
  });

  it('allows when the route requires no permissions at all', async () => {
    const ctx = makeContext({ permissions: undefined });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockScopeService.assertEmployeeInScope).not.toHaveBeenCalled();
    expect(mockScopeService.getScopedEmployeeIds).not.toHaveBeenCalled();
  });

  it('resolves ScopeService lazily via ModuleRef only once it is actually needed', async () => {
    makeContext({ permissions: undefined }); // a route that never needs ScopeService
    expect(mockModuleRef.resolve).not.toHaveBeenCalled();
  });

  describe('@ScopeParam routes', () => {
    it('extracts the target id from params and checks scope', async () => {
      const request = { tenantContext, params: { id: 'emp-target' }, body: {}, query: {} };
      const ctx = makeContext({ request, permissions: ['employee.read'], scopeParam: 'id' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(mockScopeService.assertEmployeeInScope).toHaveBeenCalledWith(
        tenantContext,
        'employee.read',
        'emp-target',
      );
    });

    it('falls back to body, then query, when the key is not in params', async () => {
      const request = { tenantContext, params: {}, body: { employee_id: 'emp-body' }, query: {} };
      const ctx = makeContext({ request, permissions: ['attendance.write'], scopeParam: 'employee_id' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(mockScopeService.assertEmployeeInScope).toHaveBeenCalledWith(
        tenantContext,
        'attendance.write',
        'emp-body',
      );
    });

    it('denies (false) when the scope param key is present in metadata but missing from the request', async () => {
      const request = { tenantContext, params: {}, body: {}, query: {} };
      const ctx = makeContext({ request, permissions: ['employee.read'], scopeParam: 'id' });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
      expect(mockScopeService.assertEmployeeInScope).not.toHaveBeenCalled();
    });

    it('propagates the ForbiddenException thrown by ScopeService for an out-of-scope target', async () => {
      const request = { tenantContext, params: { id: 'emp-other' }, body: {}, query: {} };
      const ctx = makeContext({ request, permissions: ['employee.read'], scopeParam: 'id' });
      mockScopeService.assertEmployeeInScope.mockRejectedValueOnce(new ForbiddenException());
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('@RequireScope routes', () => {
    it('resolves the resource to an employee id via the resolver, then checks scope', async () => {
      const mockResolver = { resolveEmployeeId: jest.fn().mockResolvedValue('emp-owner') };
      const resolverType = class {} as any;
      mockModuleRef.resolve.mockImplementation((token: any) =>
        Promise.resolve(token === ScopeService ? mockScopeService : token === resolverType ? mockResolver : undefined),
      );
      const request = { tenantContext, params: { slipId: 'slip-1' }, body: {}, query: {} };
      const meta: RequireScopeMeta = { resolver: resolverType, param: 'slipId' };
      const ctx = makeContext({ request, permissions: ['payroll.read'], requireScope: meta });

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(mockResolver.resolveEmployeeId).toHaveBeenCalledWith(tenantContext, 'slip-1');
      expect(mockScopeService.assertEmployeeInScope).toHaveBeenCalledWith(tenantContext, 'payroll.read', 'emp-owner');
    });

    it('throws 404 (not 403) when the resolver reports the resource does not exist', async () => {
      const mockResolver = { resolveEmployeeId: jest.fn().mockResolvedValue(null) };
      const resolverType = class {} as any;
      mockModuleRef.resolve.mockImplementation((token: any) =>
        Promise.resolve(token === ScopeService ? mockScopeService : token === resolverType ? mockResolver : undefined),
      );
      const request = { tenantContext, params: { slipId: 'unknown-slip' }, body: {}, query: {} };
      const meta: RequireScopeMeta = { resolver: resolverType, param: 'slipId' };
      const ctx = makeContext({ request, permissions: ['payroll.read'], requireScope: meta });

      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
      expect(mockScopeService.assertEmployeeInScope).not.toHaveBeenCalled();
    });
  });

  describe('list routes (neither @ScopeParam nor @RequireScope)', () => {
    it('resolves scopedEmployeeIds and attaches it to tenantContext on the request', async () => {
      const request: any = { tenantContext, params: {}, body: {}, query: {} };
      mockScopeService.getScopedEmployeeIds.mockResolvedValueOnce(['emp-a', 'emp-b']);
      const ctx = makeContext({ request, permissions: ['employee.read'] });

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(mockScopeService.getScopedEmployeeIds).toHaveBeenCalledWith(tenantContext, 'employee.read');
      expect(request.tenantContext.scopedEmployeeIds).toEqual(['emp-a', 'emp-b']);
    });

    it("attaches the 'ALL' sentinel for ORGANIZATION scope without mutating other tenantContext fields", async () => {
      const request: any = { tenantContext: { ...tenantContext }, params: {}, body: {}, query: {} };
      mockScopeService.getScopedEmployeeIds.mockResolvedValueOnce('ALL');
      const ctx = makeContext({ request, permissions: ['employee.read'] });

      await guard.canActivate(ctx);
      expect(request.tenantContext).toEqual({ ...tenantContext, scopedEmployeeIds: 'ALL' });
    });
  });

  it('uses only the first permission when a route requires more than one (§6.7)', async () => {
    const request = { tenantContext, params: { id: 'emp-self' }, body: {}, query: {} };
    const ctx = makeContext({ request, permissions: ['employee.read', 'employee.sensitive.read'], scopeParam: 'id' });
    await guard.canActivate(ctx);
    expect(mockScopeService.assertEmployeeInScope).toHaveBeenCalledWith(tenantContext, 'employee.read', 'emp-self');
  });
});
