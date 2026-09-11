import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { TenantContext } from '../database/tenant-context';
import { NotificationsRepository } from './notifications.repository';
import { EventsService, NotificationEvent } from '../common/events/events.service';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repository: NotificationsRepository,
    private readonly eventsService: EventsService,
  ) {}

  onModuleInit() {
    this.eventsService.onNotification((event) => this.handleNotificationEvent(event));
  }

  private async handleNotificationEvent(event: NotificationEvent): Promise<void> {
    try {
      await this.repository.create(
        event.organizationId,
        event.userId,
        event.type,
        event.title,
        event.body,
      );
    } catch (err) {
      // A failed notification write must never surface as a failure of
      // whatever business action triggered it - this listener runs
      // decoupled from that action's own request/transaction.
      this.logger.error(`Failed to persist notification (type=${event.type})`, err as Error);
    }
  }

  async listRecent(tenantContext: TenantContext, limit?: number) {
    const safeLimit = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    const [notifications, unreadCount] = await Promise.all([
      this.repository.findRecentForUser(tenantContext, safeLimit),
      this.repository.countUnreadForUser(tenantContext),
    ]);

    return { notifications, unreadCount };
  }

  async markRead(tenantContext: TenantContext, id: string) {
    const notification = await this.repository.markRead(tenantContext, id);
    if (!notification) {
      // Covers both "doesn't exist" and "already read" - either way there's
      // nothing further for the caller to do, and no need to distinguish
      // the two for a personal, own-data-only resource like this.
      throw new NotFoundException('Notification not found or already read');
    }
    return notification;
  }

  async markAllRead(tenantContext: TenantContext) {
    const count = await this.repository.markAllRead(tenantContext);
    return { markedCount: count };
  }
}
