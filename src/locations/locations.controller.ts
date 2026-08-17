import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import type { TenantContext } from '../database/tenant-context';

@Controller('locations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LocationsController {
  constructor(private service: LocationsService) {}

  @Post()
  @RequirePermissions('organization.write')
  async create(@CurrentUser() ctx: TenantContext, @Body() dto: any) {
    const location = await this.service.create(ctx, dto);
    return { success: true, data: location };
  }

  @Get()
  @RequirePermissions('organization.read')
  async getAll(@CurrentUser() ctx: TenantContext) {
    const locations = await this.service.getAll(ctx);
    return { success: true, data: locations };
  }

  @Get(':id')
  @RequirePermissions('organization.read')
  async getById(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    const location = await this.service.getById(ctx, id);
    return { success: true, data: location };
  }

  @Put(':id')
  @RequirePermissions('organization.write')
  async update(@CurrentUser() ctx: TenantContext, @Param('id') id: string, @Body() dto: any) {
    const location = await this.service.update(ctx, id, dto);
    return { success: true, data: location };
  }

  @Delete(':id')
  @RequirePermissions('organization.write')
  async delete(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    await this.service.delete(ctx, id);
    return { success: true, message: 'Location deleted' };
  }
}
