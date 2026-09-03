import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantContextDecorator, type TenantContext } from '../database/tenant-context';
import { requireEmployeeId } from '../common/util/require-employee.util';

@Controller('attendance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Post('clock-in')
  @RequirePermissions('attendance.write')
  async clockIn(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Body() dto: { notes?: string },
  ) {
    const record = await this.service.clockIn(
      tenantContext,
      requireEmployeeId(tenantContext),
      dto,
    );
    return { success: true, data: record };
  }

  @Post('clock-out')
  @RequirePermissions('attendance.write')
  async clockOut(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Body() dto: { notes?: string },
  ) {
    const record = await this.service.clockOut(
      tenantContext,
      requireEmployeeId(tenantContext),
      dto,
    );
    return { success: true, data: record };
  }

  @Post('mark')
  @RequirePermissions('attendance.manage')
  async markAttendance(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Body() dto: any,
  ) {
    const record = await this.service.markAttendance(tenantContext, dto, tenantContext.userId);
    return { success: true, data: record };
  }

  @Get('date/:date')
  @RequirePermissions('attendance.read')
  async getByDate(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('date') date: string,
  ) {
    const record = await this.service.getAttendanceByDate(
      tenantContext,
      requireEmployeeId(tenantContext),
      date,
    );
    return { success: true, data: record };
  }

  @Get('range')
  @RequirePermissions('attendance.read')
  async getByDateRange(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const records = await this.service.getAttendanceByDateRange(
      tenantContext,
      requireEmployeeId(tenantContext),
      startDate,
      endDate,
    );
    return { success: true, data: records };
  }

  @Get('summary')
  @RequirePermissions('attendance.read')
  async getSummary(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Query('month') month: string,
  ) {
    const summary = await this.service.getAttendanceSummary(
      tenantContext,
      requireEmployeeId(tenantContext),
      month,
    );
    return { success: true, data: summary };
  }

  @Get('employee/:employeeId/date/:date')
  @RequirePermissions('attendance.read')
  async getEmployeeByDate(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('employeeId') employeeId: string,
    @Param('date') date: string,
  ) {
    const record = await this.service.getAttendanceByDate(tenantContext, employeeId, date);
    return { success: true, data: record };
  }

  @Get('employee/:employeeId/range')
  @RequirePermissions('attendance.read')
  async getEmployeeByDateRange(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('employeeId') employeeId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const records = await this.service.getAttendanceByDateRange(
      tenantContext,
      employeeId,
      startDate,
      endDate,
    );
    return { success: true, data: records };
  }
}
