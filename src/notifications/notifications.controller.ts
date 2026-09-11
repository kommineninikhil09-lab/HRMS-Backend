import { Controller, Get, Put, Param, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { TenantContextDecorator, type TenantContext } from '../database/tenant-context';

// No @RequirePermissions on any route here — notifications are always scoped
// to the caller's own user_id (not employee-keyed, not org data), so being
// authenticated is the only check that applies.
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.notificationsService.listRecent(tenantContext, limit);
  }

  @Put(':id/read')
  async markRead(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const notification = await this.notificationsService.markRead(tenantContext, id);
    return { notification };
  }

  @Put('read-all')
  async markAllRead(@TenantContextDecorator() tenantContext: TenantContext) {
    return this.notificationsService.markAllRead(tenantContext);
  }
}
