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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import type { TenantContext } from '../database/tenant-context';

@Controller('leave')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeaveController {
  constructor(private readonly service: LeaveService) {}

  @Post('requests')
  @RequirePermissions('leave.write')
  async createLeaveRequest(
    @CurrentUser() tenantContext: TenantContext,
    @Body() dto: any,
  ) {
    const request = await this.service.createLeaveRequest(
      tenantContext,
      tenantContext.userId,
      dto,
    );
    return { success: true, data: request };
  }

  @Get('requests')
  @RequirePermissions('leave.read')
  async getLeaveRequests(
    @CurrentUser() tenantContext: TenantContext,
    @Query('status') status?: string,
  ) {
    const requests = await this.service.getEmployeeLeaveRequests(
      tenantContext,
      tenantContext.userId,
      status,
    );
    return { success: true, data: requests };
  }

  @Get('requests/:id')
  @RequirePermissions('leave.read')
  async getLeaveRequest(
    @CurrentUser() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    // Implementation for fetching specific leave request
    return { success: true, data: {} };
  }

  @Get('balance')
  @RequirePermissions('leave.read')
  async getLeaveBalance(
    @CurrentUser() tenantContext: TenantContext,
  ) {
    const balance = await this.service.getLeaveBalance(tenantContext, tenantContext.userId);
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

  @Put('requests/:id/approve')
  @RequirePermissions('leave.approve')
  async approveLeaveRequest(
    @CurrentUser() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const request = await this.service.approveLeaveRequest(
      tenantContext,
      id,
      tenantContext.userId,
      dto,
    );
    return { success: true, data: request };
  }

  @Get('approvals/pending')
  @RequirePermissions('leave.approve')
  async getPendingApprovals(
    @CurrentUser() tenantContext: TenantContext,
  ) {
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
      status,
    );
    return { success: true, data: requests };
  }
}
