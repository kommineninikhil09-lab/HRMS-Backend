import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ESSService } from './ess.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import type { TenantContext } from '../database/tenant-context';

@Controller('ess')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ESSController {
  constructor(private readonly service: ESSService) {}

  @Get('dashboard')
  @RequirePermissions('ess.read')
  async getDashboard(@CurrentUser() tenantContext: TenantContext) {
    const dashboard = await this.service.getEmployeeDashboard(
      tenantContext,
      tenantContext.userId,
    );
    return { success: true, data: dashboard };
  }

  @Get('profile')
  @RequirePermissions('ess.read')
  async getProfile(@CurrentUser() tenantContext: TenantContext) {
    const profile = await this.service.getEmployeeProfile(
      tenantContext,
      tenantContext.userId,
    );
    return { success: true, data: profile };
  }

  @Put('profile')
  @RequirePermissions('ess.update')
  async updateProfile(
    @CurrentUser() tenantContext: TenantContext,
    @Body() dto: any,
  ) {
    const profile = await this.service.updateProfile(
      tenantContext,
      tenantContext.userId,
      dto,
    );
    return { success: true, data: profile };
  }

  @Get('documents')
  @RequirePermissions('ess.read')
  async getDocuments(@CurrentUser() tenantContext: TenantContext) {
    const documents = await this.service.getEmployeeDocuments(
      tenantContext,
      tenantContext.userId,
    );
    return { success: true, data: documents };
  }
}
