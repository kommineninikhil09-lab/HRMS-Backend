import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

/**
 * A notification-worthy domain event. `type` doubles as the notification
 * row's own `type` column (and, on the frontend, the prefix
 * NotificationsDropdown's linkForType routes on) - keep new values
 * consistent with that mapping.
 */
export interface NotificationEvent {
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
}

const NOTIFICATION_EVENT = 'notification';

/**
 * In-process pub/sub for side effects that shouldn't block or couple into
 * the business transaction that triggers them (v1 explicitly has no message
 * queue - see Tasks.md P3-02). A plain Node EventEmitter wrapped for DI
 * rather than the @nestjs/event-emitter package, since this app has exactly
 * one event shape and one consumer today; not worth a new dependency for.
 */
@Injectable()
export class EventsService {
  private readonly emitter = new EventEmitter();

  emitNotification(event: NotificationEvent): void {
    this.emitter.emit(NOTIFICATION_EVENT, event);
  }

  onNotification(handler: (event: NotificationEvent) => void): void {
    this.emitter.on(NOTIFICATION_EVENT, handler);
  }
}
