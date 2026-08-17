import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BusinessUnitsService } from './business-units.service';
import { CreateBusinessUnitDto } from './dto/create-business-unit.dto';
import { UpdateBusinessUnitDto } from './dto/update-business-unit.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import type { TenantContext } from '../database/tenant-context';

@Controller('business-units')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BusinessUnitsController {
  constructor(private readonly service: BusinessUnitsService) {}

  @Post()
  @RequirePermissions('organization.write')
  async create(@CurrentUser() tenantContext: TenantContext, @Body() dto: CreateBusinessUnitDto) {
    const unit = await this.service.create(tenantContext, dto);
    return { success: true, data: unit };
  }

  @Get()
  @RequirePermissions('organization.read')
  async getAll(
    @CurrentUser() tenantContext: TenantContext,
    @Query('status') status?: string,
  ) {
    const units = await this.service.getAll(tenantContext, { status });
    return { success: true, data: units };
  }

  @Get(':id')
  @RequirePermissions('organization.read')
  async getById(@CurrentUser() tenantContext: TenantContext, @Param('id') id: string) {
    const unit = await this.service.getById(tenantContext, id);
    return { success: true, data: unit };
  }

  @Get(':id/children')
  @RequirePermissions('organization.read')
  async getChildren(@CurrentUser() tenantContext: TenantContext, @Param('id') id: string) {
    const children = await this.service.getChildren(tenantContext, id);
    return { success: true, data: children };
  }

  @Put(':id')
  @RequirePermissions('organization.write')
  async update(
    @CurrentUser() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateBusinessUnitDto,
  ) {
    const unit = await this.service.update(tenantContext, id, dto);
    return { success: true, data: unit };
  }

  @Delete(':id')
  @RequirePermissions('organization.write')
  async delete(@CurrentUser() tenantContext: TenantContext, @Param('id') id: string) {
    await this.service.delete(tenantContext, id);
    return { success: true, message: 'Business unit deleted' };
  }
}
