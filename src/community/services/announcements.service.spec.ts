import { ForbiddenException } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { TenantContext, ORG_SCOPE } from '../../database/tenant-context';

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

describe('AnnouncementsService.publishAnnouncement — locked to org scope (P1-19)', () => {
  let announcementsRepository: any;
  let auditService: any;
  let service: AnnouncementsService;

  const announcement = { id: 'ann-1', status: 'draft' };

  beforeEach(() => {
    announcementsRepository = {
      findById: jest.fn().mockResolvedValue(announcement),
      publish: jest.fn().mockResolvedValue({ ...announcement, status: 'published' }),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    service = new AnnouncementsService(announcementsRepository, auditService);
  });

  it('team scope, even with announcement.update: 403s before the announcement is even fetched', async () => {
    const ctx = makeContext({
      permissions: ['announcement.update'],
      scope: { kind: 'team', employeeIds: new Set() },
    });
    await expect(service.publishAnnouncement(ctx, 'ann-1')).rejects.toThrow(ForbiddenException);
    expect(announcementsRepository.findById).not.toHaveBeenCalled();
  });

  it('self scope: 403s', async () => {
    const ctx = makeContext();
    await expect(service.publishAnnouncement(ctx, 'ann-1')).rejects.toThrow(ForbiddenException);
  });

  it('org scope: succeeds', async () => {
    const ctx = makeContext({ scope: ORG_SCOPE });
    const result = await service.publishAnnouncement(ctx, 'ann-1');
    expect(result.status).toBe('published');
  });
});
