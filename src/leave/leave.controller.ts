import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LeaveService } from './leave.service';
import { HolidaysService } from '../holidays/holidays.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ApproveLeaveRequestDto } from './dto/approve-leave-request.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import type { TenantContext } from '../database/tenant-context';
import { requireEmployeeId } from '../common/util/require-employee.util';

@Controller('leave')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeaveController {
  constructor(
    private readonly service: LeaveService,
    private readonly holidaysService: HolidaysService,
  ) {}

  @Post('requests')
  @RequirePermissions('leave.write')
  async createLeaveRequest(
    @CurrentUser() tenantContext: TenantContext,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    const request = await this.service.createLeaveRequest(
      tenantContext,
      requireEmployeeId(tenantContext),
      dto,
    );
    return { success: true, data: request };
  }

  @Get('requests')
  @RequirePermissions('leave.read')
  async getLeaveRequests(
    @CurrentUser() tenantContext: TenantContext,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const requests = await this.service.getEmployeeLeaveRequests(
      tenantContext,
      requireEmployeeId(tenantContext),
      { status, from, to },
    );
    return { success: true, data: requests };
  }

  @Get('requests/:id')
  @RequirePermissions('leave.read')
  async getLeaveRequest(
    @CurrentUser() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const request = await this.service.getLeaveRequestById(tenantContext, id);
    return { success: true, data: request };
  }

  @Post('requests/:id/cancel')
  @RequirePermissions('leave.write')
  async cancelLeaveRequest(
    @CurrentUser() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const request = await this.service.cancelLeaveRequest(
      tenantContext,
      id,
      requireEmployeeId(tenantContext),
    );
    return { success: true, data: request };
  }

  @Put('requests/:id/approve')
  @RequirePermissions('leave.approve')
  async approveLeaveRequest(
    @CurrentUser() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: ApproveLeaveRequestDto,
  ) {
    // The approver is identified by their user id (approver_id → users(id)).
    const request = await this.service.approveLeaveRequest(
      tenantContext,
      id,
      tenantContext.userId,
      dto,
    );
    return { success: true, data: request };
  }

  @Get('balance')
  @RequirePermissions('leave.read')
  async getLeaveBalance(@CurrentUser() tenantContext: TenantContext) {
    const balance = await this.service.getLeaveBalance(
      tenantContext,
      requireEmployeeId(tenantContext),
    );
    return { success: true, data: balance };
  }

  @Get('balance/employee/:employeeId')
  @RequirePermissions('leave.read')
  async getEmployeeLeaveBalance(
    @CurrentUser() tenantContext: TenantContext,
    @Param('employeeId') employeeId: string,
  ) {
    const balance = await this.service.getLeaveBalance(tenantContext, employeeId);
    return { success: true, data: balance };
  }

  @Get('approvals/pending')
  @RequirePermissions('leave.approve')
  async getPendingApprovals(@CurrentUser() tenantContext: TenantContext) {
    const requests = await this.service.getPendingApprovals(
      tenantContext,
      tenantContext.userId,
    );
    return { success: true, data: requests };
  }

  @Get('employee/:employeeId/requests')
  @RequirePermissions('leave.read')
  async getEmployeeRequests(
    @CurrentUser() tenantContext: TenantContext,
    @Param('employeeId') employeeId: string,
    @Query('status') status?: string,
  ) {
    const requests = await this.service.getEmployeeLeaveRequests(
      tenantContext,
      employeeId,
      { status },
    );
    return { success: true, data: requests };
  }

  @Get('types')
  @RequirePermissions('leave.read')
  async getLeaveTypes(@CurrentUser() tenantContext: TenantContext) {
    const types = await this.service.getLeaveTypes(tenantContext);
    return { success: true, data: types };
  }

  @Get('calendar')
  @RequirePermissions('leave.read')
  async getCalendar(
    @CurrentUser() tenantContext: TenantContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.service.getLeaveCalendar(tenantContext, from, to);
    return { success: true, data };
  }

  @Get('holidays')
  @RequirePermissions('leave.read')
  async getHolidays(
    @CurrentUser() tenantContext: TenantContext,
    @Query('year') year?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.holidaysService.list(tenantContext, {
      year,
      from,
      to,
    });
    return { success: true, data };
  }
}
