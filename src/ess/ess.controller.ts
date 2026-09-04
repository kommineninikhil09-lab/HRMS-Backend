import { Controller, Get, Put, Body } from '@nestjs/common';
import { ESSService } from './ess.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { TenantContextDecorator, type TenantContext } from '../database/tenant-context';

// No class-level @UseGuards(JwtAuthGuard, PermissionsGuard) — both already
// run globally. Same redundant-registration bug fixed in employees/
// attendance/leave controllers. Every route here is self-derived
// (tenantContext.userId) with no employee-targeted path, so no
// @ScopeParam/@RequireScope is needed — there's nothing to scope-check.
@Controller('ess')
export class ESSController {
  constructor(private readonly service: ESSService) {}

  @Get('dashboard')
  @RequirePermissions('ess.read')
  async getDashboard(@TenantContextDecorator() tenantContext: TenantContext) {
    const dashboard = await this.service.getEmployeeDashboard(
      tenantContext,
      tenantContext.userId,
    );
    return { success: true, data: dashboard };
  }

  @Get('profile')
  @RequirePermissions('ess.read')
  async getProfile(@TenantContextDecorator() tenantContext: TenantContext) {
    const profile = await this.service.getEmployeeProfile(
      tenantContext,
      tenantContext.userId,
    );
    return { success: true, data: profile };
  }

  @Put('profile')
  @RequirePermissions('ess.update')
  async updateProfile(
    @TenantContextDecorator() tenantContext: TenantContext,
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
  async getDocuments(@TenantContextDecorator() tenantContext: TenantContext) {
    const documents = await this.service.getEmployeeDocuments(
      tenantContext,
      tenantContext.userId,
    );
    return { success: true, data: documents };
  }
}
