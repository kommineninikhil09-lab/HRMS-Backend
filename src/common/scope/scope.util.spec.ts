import { ForbiddenException } from '@nestjs/common';
import { assertActingOnEmployee, scopedEmployeeIds } from './scope.util';
import { TenantContext, ORG_SCOPE, SELF_SCOPE } from '../../database/tenant-context';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

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

describe('assertActingOnEmployee', () => {
  it('never throws for org scope, regardless of target', () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    expect(() => assertActingOnEmployee(ctx, 'anyone-else')).not.toThrow();
  });

  it('never throws when acting on yourself, even with self scope', () => {
    const ctx = makeContext({ employeeId: 'self-employee-1', scope: SELF_SCOPE });
    expect(() => assertActingOnEmployee(ctx, 'self-employee-1')).not.toThrow();
  });

  it('never throws when acting on yourself, even with team scope that does not list you', () => {
    const ctx = makeContext({
      employeeId: 'self-employee-1',
      scope: { kind: 'team', employeeIds: new Set(['someone-else']) },
    });
    expect(() => assertActingOnEmployee(ctx, 'self-employee-1')).not.toThrow();
  });

  it('allows a target inside the resolved team set', () => {
    const ctx = makeContext({
      scope: { kind: 'team', employeeIds: new Set(['report-1', 'report-2']) },
    });
    expect(() => assertActingOnEmployee(ctx, 'report-1')).not.toThrow();
  });

  it('throws ForbiddenException for a target outside the resolved team set', () => {
    const ctx = makeContext({
      scope: { kind: 'team', employeeIds: new Set(['report-1']) },
    });
    expect(() => assertActingOnEmployee(ctx, 'not-a-report')).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException for any other employee under self scope', () => {
    const ctx = makeContext({ scope: SELF_SCOPE });
    expect(() => assertActingOnEmployee(ctx, 'someone-else')).toThrow(ForbiddenException);
  });

  it('treats an undefined scope as self scope (fail-closed)', () => {
    const ctx = makeContext({ scope: undefined });
    expect(() => assertActingOnEmployee(ctx, 'someone-else')).toThrow(ForbiddenException);
    expect(() => assertActingOnEmployee(ctx, ctx.employeeId as string)).not.toThrow();
  });

  it('throws for a caller with no employeeId acting on anyone, including a matching-looking id', () => {
    const ctx = makeContext({ employeeId: null, scope: SELF_SCOPE });
    expect(() => assertActingOnEmployee(ctx, 'some-target')).toThrow(ForbiddenException);
  });
});

describe('scopedEmployeeIds', () => {
  it('returns null for org scope (no filter)', () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    expect(scopedEmployeeIds(ctx)).toBeNull();
  });

  it('returns the resolved team set plus the caller, deduplicated', () => {
    const ctx = makeContext({
      employeeId: 'self-employee-1',
      scope: { kind: 'team', employeeIds: new Set(['report-1', 'report-2', 'self-employee-1']) },
    });
    const result = scopedEmployeeIds(ctx);
    expect(result).not.toBeNull();
    expect(new Set(result)).toEqual(new Set(['report-1', 'report-2', 'self-employee-1']));
    expect(result).toHaveLength(3);
  });

  it('returns just the caller under self scope', () => {
    const ctx = makeContext({ employeeId: 'self-employee-1', scope: SELF_SCOPE });
    expect(scopedEmployeeIds(ctx)).toEqual(['self-employee-1']);
  });

  it('returns just the caller under undefined scope (fail-closed to self)', () => {
    const ctx = makeContext({ employeeId: 'self-employee-1', scope: undefined });
    expect(scopedEmployeeIds(ctx)).toEqual(['self-employee-1']);
  });

  it('returns the nil-UUID sentinel when self scope has no employeeId, never an empty array', () => {
    const ctx = makeContext({ employeeId: null, scope: SELF_SCOPE });
    const result = scopedEmployeeIds(ctx);
    expect(result).toEqual([NIL_UUID]);
    expect(result).not.toEqual([]);
  });
});
