import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { TenantContext } from '../database/tenant-context';
import { requireEmployeeId } from '../common/util/require-employee.util';
import {
  CheckInDto,
  CheckOutDto,
  AttendanceQueryDto,
  AdminAttendanceQueryDto,
  MarkAttendanceDto,
} from './dto/attendance.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  // ----- Employee (self) --------------------------------------------------

  @Post('check-in')
  @RequirePermissions('attendance.write')
  async checkIn(
    @CurrentUser() tenantContext: TenantContext,
    @Body() dto: CheckInDto,
  ) {
    const data = await this.service.checkIn(
      tenantContext,
      requireEmployeeId(tenantContext),
      dto,
    );
    return { success: true, data };
  }

  @Post('check-out')
  @RequirePermissions('attendance.write')
  async checkOut(
    @CurrentUser() tenantContext: TenantContext,
    @Body() dto: CheckOutDto,
  ) {
    const data = await this.service.checkOut(
      tenantContext,
      requireEmployeeId(tenantContext),
      dto,
    );
    return { success: true, data };
  }

  @Get('today')
  @RequirePermissions('attendance.read')
  async getToday(@CurrentUser() tenantContext: TenantContext) {
    const data = await this.service.getToday(
      tenantContext,
      requireEmployeeId(tenantContext),
    );
    return { success: true, data };
  }

  @Get()
  @RequirePermissions('attendance.read')
  async getHistory(
    @CurrentUser() tenantContext: TenantContext,
    @Query() query: AttendanceQueryDto,
  ) {
    const data = await this.service.getHistory(
      tenantContext,
      requireEmployeeId(tenantContext),
      query,
    );
    return { success: true, data };
  }

  @Get('summary')
  @RequirePermissions('attendance.read')
  async getSummary(
    @CurrentUser() tenantContext: TenantContext,
    @Query() query: AttendanceQueryDto,
  ) {
    const data = await this.service.getSummary(
      tenantContext,
      requireEmployeeId(tenantContext),
      query,
    );
    return { success: true, data };
  }

  // ----- Admin / HR -----------------------------------------------------
  // `attendance.manage` is held only by HR Manager / Admin / Super Admin, so a
  // normal employee (attendance.read + write) cannot reach any of these.

  @Get('admin')
  @RequirePermissions('attendance.manage')
  async adminList(
    @CurrentUser() tenantContext: TenantContext,
    @Query() query: AdminAttendanceQueryDto,
  ) {
    const data = await this.service.adminList(tenantContext, query);
    return { success: true, data };
  }

  @Get('admin/:employeeId')
  @RequirePermissions('attendance.manage')
  async adminEmployeeHistory(
    @CurrentUser() tenantContext: TenantContext,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: AttendanceQueryDto,
  ) {
    const data = await this.service.adminEmployeeHistory(
      tenantContext,
      employeeId,
      query,
    );
    return { success: true, data };
  }

  @Get('admin/:employeeId/summary')
  @RequirePermissions('attendance.manage')
  async adminEmployeeSummary(
    @CurrentUser() tenantContext: TenantContext,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: AttendanceQueryDto,
  ) {
    const data = await this.service.adminEmployeeSummary(
      tenantContext,
      employeeId,
      query,
    );
    return { success: true, data };
  }

  @Post('admin/mark')
  @RequirePermissions('attendance.manage')
  async markAttendance(
    @CurrentUser() tenantContext: TenantContext,
    @Body() dto: MarkAttendanceDto,
  ) {
    const data = await this.service.markAttendance(
      tenantContext,
      dto,
      tenantContext.userId,
    );
    return { success: true, data };
  }
}
