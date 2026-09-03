import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import type { TenantContext } from '../database/tenant-context';

@Controller('holidays')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HolidaysController {
  constructor(private readonly service: HolidaysService) {}

  @Get()
  @RequirePermissions('holiday.read')
  async list(
    @CurrentUser() tenantContext: TenantContext,
    @Query('year') year?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.service.list(tenantContext, { year, from, to });
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('holiday.write')
  async create(
    @CurrentUser() tenantContext: TenantContext,
    @Body() dto: CreateHolidayDto,
  ) {
    const data = await this.service.create(tenantContext, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('holiday.write')
  async remove(
    @CurrentUser() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    await this.service.remove(tenantContext, id);
    return { success: true };
  }
}
