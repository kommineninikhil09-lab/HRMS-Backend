import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../database/tenant-context';
import { NotificationsRepository } from './notifications.repository';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

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
