import { Injectable, CanActivate, ExecutionContext, NotFoundException, Type } from '@nestjs/common';
import { Reflector, ModuleRef } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SCOPE_PARAM_KEY } from './scope-param.decorator';
import { REQUIRE_SCOPE_KEY, RequireScopeMeta } from './require-scope.decorator';
import { ScopeService } from './scope.service';
import { ResourceResolver } from './resource-resolver.interface';
import { TenantContext } from '../../database/tenant-context';

/**
 * Runs after PermissionsGuard (registered second as an APP_GUARD in
 * app.module.ts). PermissionsGuard already confirmed the caller holds the
 * required permission at all; this guard resolves *scope* — which specific
 * employees that permission actually reaches for this caller — and either
 * checks a single target (@ScopeParam / @RequireScope) or attaches the
 * resolved filter set to tenantContext for list routes.
 *
 * implementation.md §6.7 flagged that the original draft read a metadata key
 * ('permission', singular) that doesn't exist on the real RequirePermissions
 * decorator (which stores 'permissions', plural, string[]) — that mismatch
 * would have silently no-op'd scope checking on every real route. Reads the
 * real PERMISSIONS_KEY here.
 *
 * Dependency resolution note: this guard does NOT take ScopeService as a
 * normal constructor-injected dependency. Every declarative way of wiring
 * that up was tried and verified broken against a live, running server —
 * not assumed from docs, each reproduced and confirmed:
 *  - `useClass: ScopeGuard` (registered directly in AppModule's providers)
 *    constructed the instance with `scopeService` silently undefined
 *    (`Reflector` alone was fine), crashing every request with "Cannot read
 *    properties of undefined (reading 'getAllAndOverride')".
 *  - `useExisting: ScopeGuard` (ScopeGuard provided by AuthorizationModule,
 *    where its own dependencies resolve correctly on their own) constructed
 *    a working instance, but Nest's global-enhancer collection for
 *    APP_GUARD never actually *invoked* it for any route — confirmed with a
 *    file-based execution trace at the top of canActivate that simply never
 *    got written, for every request including @Public() ones.
 *  - A `useFactory` manually resolving every dependency via `moduleRef.get()`
 *    got further (the guard *did* run) but the resolved ScopeService's own
 *    `pool` came back undefined the same way, one layer deeper.
 *  - Moving the `{ provide: APP_GUARD, useClass: ScopeGuard }` registration
 *    into AuthorizationModule itself (so ScopeGuard's ScopeService
 *    dependency is same-module, not cross-module) still failed — this time
 *    even `Reflector` came back undefined, with or without an explicit
 *    `@Inject()` token. So this isn't a module-boundary problem at all.
 *
 * The common thread: everything that resolves user-defined providers
 * *eagerly*, at APP_GUARD provider-construction time, fails — including
 * providers from `@Global()` modules. What works is resolving lazily,
 * on the first real request, well after the whole module graph has finished
 * bootstrapping — at which point `ModuleRef.get()` is reliable. `ModuleRef`
 * itself is the one thing safe to take as a constructor dependency here,
 * since it needs no resolution of its own. `Reflector` needs no DI at all —
 * it's a stateless wrapper with no dependencies — so it's just constructed
 * directly rather than risking the same failure class for zero benefit.
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  private readonly reflector = new Reflector();
  private scopeService: ScopeService | undefined;
  private readonly resolverCache = new Map<Type<ResourceResolver>, ResourceResolver>();

  constructor(private readonly moduleRef: ModuleRef) {}

  private async getScopeService(): Promise<ScopeService> {
    if (!this.scopeService) {
      // `resolve()` (async, walks the full DI graph) rather than `get()`
      // (sync) — `get({ strict: false })` reliably returned a ScopeService
      // *instance* but with its own constructor-injected `pool` silently
      // undefined, verified against a live server. `resolve()` uses a
      // different underlying resolution path and does not have this problem.
      const resolved = await this.moduleRef.resolve(ScopeService, undefined, { strict: false });
      if (!resolved) {
        throw new Error('ScopeGuard: ScopeService could not be resolved from the module graph');
      }
      this.scopeService = resolved;
    }
    return this.scopeService;
  }

  // Same `.resolve()`-not-`.get()` requirement as ScopeService above — a
  // @RequireScope resolver is just as likely to have its own repository
  // dependency come back with an undefined `pool` under `.get()`.
  private async getResolver(resolverType: Type<ResourceResolver>): Promise<ResourceResolver> {
    let resolver = this.resolverCache.get(resolverType);
    if (!resolver) {
      const resolved = await this.moduleRef.resolve(resolverType, undefined, { strict: false });
      if (!resolved) {
        throw new Error(`ScopeGuard: resolver ${resolverType.name} could not be resolved from the module graph`);
      }
      resolver = resolved;
      this.resolverCache.set(resolverType, resolver);
    }
    return resolver;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Public routes never get a tenantContext (JwtAuthGuard skips
    // handleRequest for them) — mirror JwtAuthGuard/PermissionsGuard's own
    // public-route check rather than falling through to the tenantContext
    // guard below, which would otherwise deny every public route.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const tenantContext: TenantContext | undefined = (request as any).tenantContext;
    if (!tenantContext) return false;

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    // A scope-checked route must resolve to exactly one permission for the
    // scope check itself. A route requiring more than one permission AND
    // scope-checking needs to pick which permission the scope check runs
    // against — for v1 we take the first and rely on code review to catch a
    // route where that's ambiguous, rather than guessing (§6.7).
    const permission = requiredPermissions[0];

    const scopeParamKey = this.reflector.get<string>(SCOPE_PARAM_KEY, context.getHandler());
    const requireScope = this.reflector.get<RequireScopeMeta>(REQUIRE_SCOPE_KEY, context.getHandler());
    const scopeService = await this.getScopeService();

    if (scopeParamKey) {
      const targetEmployeeId =
        request.params?.[scopeParamKey] ?? (request.body ?? {})[scopeParamKey] ?? (request.query ?? {})[scopeParamKey];
      if (!targetEmployeeId || typeof targetEmployeeId !== 'string') return false;

      await scopeService.assertEmployeeInScope(tenantContext, permission, targetEmployeeId);
      return true;
    }

    if (requireScope) {
      const resolver = await this.getResolver(requireScope.resolver);
      const resourceId = request.params?.[requireScope.param];
      if (!resourceId || Array.isArray(resourceId)) return false;

      const employeeId = await resolver.resolveEmployeeId(tenantContext, resourceId);
      if (!employeeId) {
        // Genuinely doesn't exist — 404, distinct from a 403 scope denial (§2.4).
        throw new NotFoundException();
      }

      await scopeService.assertEmployeeInScope(tenantContext, permission, employeeId);
      return true;
    }

    // List route (neither @ScopeParam nor @RequireScope) — resolve the
    // caller's filter set and attach it for the repository to use.
    const scopedEmployeeIds = await scopeService.getScopedEmployeeIds(tenantContext, permission);
    (request as any).tenantContext = { ...tenantContext, scopedEmployeeIds };
    return true;
  }
}
