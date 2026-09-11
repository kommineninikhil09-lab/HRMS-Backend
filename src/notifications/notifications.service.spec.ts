import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { TenantContext } from '../database/tenant-context';

function makeContext(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    organizationId: 'org-1',
    userId: 'user-1',
    employeeId: 'employee-1',
    requestId: 'req-1',
    permissions: [],
    ...overrides,
  };
}

describe('NotificationsService', () => {
  let repository: any;
  let eventsService: any;
  let service: NotificationsService;

  beforeEach(() => {
    repository = {
      create: jest.fn().mockResolvedValue({ id: 'n-1' }),
      findRecentForUser: jest.fn().mockResolvedValue([]),
      countUnreadForUser: jest.fn().mockResolvedValue(0),
      markRead: jest.fn(),
      markAllRead: jest.fn().mockResolvedValue(0),
    };
    eventsService = { onNotification: jest.fn() };
    service = new NotificationsService(repository, eventsService);
  });

  describe('listRecent', () => {
    it('fetches notifications and unread count together', async () => {
      const notifications = [{ id: 'n-1' }];
      repository.findRecentForUser.mockResolvedValue(notifications);
      repository.countUnreadForUser.mockResolvedValue(3);

      const ctx = makeContext();
      const result = await service.listRecent(ctx, 20);

      expect(result).toEqual({ notifications, unreadCount: 3 });
      expect(repository.findRecentForUser).toHaveBeenCalledWith(ctx, 20);
      expect(repository.countUnreadForUser).toHaveBeenCalledWith(ctx);
    });

    it('clamps limit to the [1, 50] range and defaults to 20', async () => {
      const ctx = makeContext();

      await service.listRecent(ctx, 500);
      expect(repository.findRecentForUser).toHaveBeenLastCalledWith(ctx, 50);

      await service.listRecent(ctx, 0);
      expect(repository.findRecentForUser).toHaveBeenLastCalledWith(ctx, 1);

      await service.listRecent(ctx, undefined);
      expect(repository.findRecentForUser).toHaveBeenLastCalledWith(ctx, 20);
    });
  });

  describe('markRead', () => {
    it('returns the updated notification on success', async () => {
      const notification = { id: 'n-1', readAt: new Date() };
      repository.markRead.mockResolvedValue(notification);

      const ctx = makeContext();
      await expect(service.markRead(ctx, 'n-1')).resolves.toEqual(notification);
    });

    it('throws NotFoundException when nothing matched (missing or already read)', async () => {
      repository.markRead.mockResolvedValue(null);

      const ctx = makeContext();
      await expect(service.markRead(ctx, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllRead', () => {
    it('returns the number of rows marked', async () => {
      repository.markAllRead.mockResolvedValue(5);

      const ctx = makeContext();
      await expect(service.markAllRead(ctx)).resolves.toEqual({ markedCount: 5 });
    });
  });

  describe('onModuleInit / notification event handling (P3-02)', () => {
    it('subscribes to EventsService on module init', () => {
      service.onModuleInit();
      expect(eventsService.onNotification).toHaveBeenCalledWith(expect.any(Function));
    });

    it('persists a row for each event the registered handler receives', async () => {
      service.onModuleInit();
      const handler = eventsService.onNotification.mock.calls[0][0];

      await handler({
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'leave.needs_approval',
        title: 'Leave request awaiting your approval',
        body: 'Jane Doe requested 2 day(s) of leave.',
      });

      expect(repository.create).toHaveBeenCalledWith(
        'org-1',
        'user-1',
        'leave.needs_approval',
        'Leave request awaiting your approval',
        'Jane Doe requested 2 day(s) of leave.',
      );
    });

    it('swallows a persistence failure rather than letting it propagate', async () => {
      repository.create.mockRejectedValue(new Error('db down'));
      service.onModuleInit();
      const handler = eventsService.onNotification.mock.calls[0][0];

      await expect(
        handler({ organizationId: 'org-1', userId: 'user-1', type: 'payslip.generated', title: 'x' }),
      ).resolves.toBeUndefined();
    });
  });
});
