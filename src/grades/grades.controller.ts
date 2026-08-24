import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { GradesService } from './grades.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import type { TenantContext } from '../database/tenant-context';

@Controller('grades')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GradesController {
  constructor(private service: GradesService) {}
  @Post() @RequirePermissions('organization_structure.write') async create(@CurrentUser() tc: TenantContext, @Body() dto: any) { return { success: true, data: await this.service.create(tc, dto) }; }
  @Get() @RequirePermissions('organization_structure.read') async getAll(@CurrentUser() tc: TenantContext) { return { success: true, data: await this.service.getAll(tc) }; }
  @Get(':id') @RequirePermissions('organization_structure.read') async getById(@CurrentUser() tc: TenantContext, @Param('id') id: string) { return { success: true, data: await this.service.getById(tc, id) }; }
  @Put(':id') @RequirePermissions('organization_structure.write') async update(@CurrentUser() tc: TenantContext, @Param('id') id: string, @Body() dto: any) { return { success: true, data: await this.service.update(tc, id, dto) }; }
  @Delete(':id') @RequirePermissions('organization_structure.write') async delete(@CurrentUser() tc: TenantContext, @Param('id') id: string) { await this.service.delete(tc, id); return { success: true }; }
}

