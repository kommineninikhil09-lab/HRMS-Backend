import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as employee-keyed: the target employee id lives directly in
 * the request (params, body, or query) under `key`. ScopeGuard reads this
 * metadata and does the actual extraction, so callers can use `@ScopeParam`
 * uniformly regardless of where the id is carried on a given route.
 *
 * Usage:
 *   @Get(':id')
 *   @RequirePermissions('employee.read')
 *   @ScopeParam('id')
 *   getById(@Param('id') id: string) { ... }
 */
export const SCOPE_PARAM_KEY = 'scopeParam';
export const ScopeParam = (key: string) => SetMetadata(SCOPE_PARAM_KEY, key);
