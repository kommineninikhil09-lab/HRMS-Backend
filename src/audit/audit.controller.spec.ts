import { ForbiddenException } from '@nestjs/common';
import { AuditController } from './audit.controller';
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

describe('AuditController.listAuditLogs — locked to org scope (P1-21)', () => {
  let auditService: any;
  let controller: AuditController;

  beforeEach(() => {
    auditService = {
      auditRepository: {
        findByOrganization: jest.fn().mockResolvedValue({ logs: [], total: 0 }),
      },
    };
    controller = new AuditController(auditService);
  });

  it('team scope, even with audit.read: 403s before the repository is ever queried', async () => {
    const req: any = {
      tenantContext: makeContext({
        permissions: ['audit.read'],
        scope: { kind: 'team', employeeIds: new Set() },
      }),
    };
    await expect(controller.listAuditLogs(req, 100, 0)).rejects.toThrow(ForbiddenException);
    expect(auditService.auditRepository.findByOrganization).not.toHaveBeenCalled();
  });

  it('self scope: 403s', async () => {
    const req: any = { tenantContext: makeContext({ permissions: ['audit.read'] }) };
    await expect(controller.listAuditLogs(req, 100, 0)).rejects.toThrow(ForbiddenException);
  });

  it('org scope: succeeds', async () => {
    const req: any = { tenantContext: makeContext({ scope: ORG_SCOPE }) };
    await expect(controller.listAuditLogs(req, 100, 0)).resolves.toBeDefined();
    expect(auditService.auditRepository.findByOrganization).toHaveBeenCalled();
  });
});
