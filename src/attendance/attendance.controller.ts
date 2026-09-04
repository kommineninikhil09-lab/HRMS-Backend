import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { EmployeesService } from '../employees/employees.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ScopeParam } from '../common/authorization/scope-param.decorator';
import { TenantContextDecorator, type TenantContext } from '../database/tenant-context';

// No class-level @UseGuards(JwtAuthGuard, PermissionsGuard) — both already
// run globally. That redundant registration is what silently broke list
// filtering on the Employees module (see employees.controller.ts): running
// JwtAuthGuard a second time unconditionally rebuilds tenantContext from the
// JWT, discarding whatever ScopeGuard had just attached. Removed here
// proactively, even though no route on this controller currently reads
// scopedEmployeeIds, so the same bug can't resurface if one is added later.
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly service: AttendanceService,
    private readonly employeesService: EmployeesService,
  ) {}

  // tenantContext.userId is a users.id, not an employees.id.
  // getAttendanceByDate/Range/Summary are shared with the already-scope-
  // checked employee-targeted routes below, which pass a real employees.id —
  // so unlike clockIn/clockOut (which resolve internally in the service),
  // these self routes resolve here first. Previously they passed
  // tenantContext.userId straight through, which silently matched no rows
  // (200 with null/empty data, not an error) instead of the caller's own
  // attendance; confirmed live.
  private async resolveSelfEmployeeId(tenantContext: TenantContext): Promise<string> {
    const employee = await this.employeesService.getByUserId(tenantContext, tenantContext.userId);
    if (!employee) {
      throw new NotFoundException('Employee record not found for current user');
    }
    return employee.id;
  }

  @Post('clock-in')
  @RequirePermissions('attendance.write')
  async clockIn(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Body() dto: { notes?: string },
  ) {
    const record = await this.service.clockIn(tenantContext, tenantContext.userId, dto);
    return { success: true, data: record };
  }

  @Post('clock-out')
  @RequirePermissions('attendance.write')
  async clockOut(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Body() dto: { notes?: string },
  ) {
    const record = await this.service.clockOut(tenantContext, tenantContext.userId, dto);
    return { success: true, data: record };
  }

  @Post('mark')
  @RequirePermissions('attendance.manage')
  @ScopeParam('employee_id')
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
    const employeeId = await this.resolveSelfEmployeeId(tenantContext);
    const record = await this.service.getAttendanceByDate(
      tenantContext,
      employeeId,
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
    const employeeId = await this.resolveSelfEmployeeId(tenantContext);
    const records = await this.service.getAttendanceByDateRange(
      tenantContext,
      employeeId,
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
    const employeeId = await this.resolveSelfEmployeeId(tenantContext);
    const summary = await this.service.getAttendanceSummary(
      tenantContext,
      employeeId,
      month,
    );
    return { success: true, data: summary };
  }

  @Get('employee/:employeeId/date/:date')
  @RequirePermissions('attendance.read')
  @ScopeParam('employeeId')
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
  @ScopeParam('employeeId')
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
