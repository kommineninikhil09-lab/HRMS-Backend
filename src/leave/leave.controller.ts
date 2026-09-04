import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { LeaveService } from './leave.service';
import { EmployeesService } from '../employees/employees.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ScopeParam } from '../common/authorization/scope-param.decorator';
import { RequireScope } from '../common/authorization/require-scope.decorator';
import { LeaveRequestResolver } from './leave-request.resolver';
import { TenantContextDecorator, type TenantContext } from '../database/tenant-context';

// No class-level @UseGuards(JwtAuthGuard, PermissionsGuard) — both already
// run globally. Same redundant-registration bug fixed in employees/
// attendance controllers: it silently wipes out scopedEmployeeIds ScopeGuard
// attaches to tenantContext. Removed here for the same reason.
@Controller('leave')
export class LeaveController {
  constructor(
    private readonly service: LeaveService,
    private readonly employeesService: EmployeesService,
  ) {}

  // tenantContext.userId is the JWT sub — a users.id, not an employees.id.
  // LeaveService's shared methods (also used by the already-scope-checked
  // employee-targeted routes below) take a real employees.id, so every
  // self-service route resolves it here first. Previously these routes
  // passed tenantContext.userId straight through as if it were an
  // employees.id, so every self-service call — create/list/balance/approve/
  // pending-approvals — failed with "Employee not found" (create) or
  // silently matched nothing (approver_id comparisons); confirmed live.
  private async resolveSelfEmployeeId(tenantContext: TenantContext): Promise<string> {
    const employee = await this.employeesService.getByUserId(tenantContext, tenantContext.userId);
    if (!employee) {
      throw new NotFoundException('Employee record not found for current user');
    }
    return employee.id;
  }

  @Post('requests')
  @RequirePermissions('leave.write')
  async createLeaveRequest(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Body() dto: any,
  ) {
    const employeeId = await this.resolveSelfEmployeeId(tenantContext);
    const request = await this.service.createLeaveRequest(
      tenantContext,
      employeeId,
      dto,
    );
    return { success: true, data: request };
  }

  @Get('requests')
  @RequirePermissions('leave.read')
  async getLeaveRequests(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Query('status') status?: string,
  ) {
    const employeeId = await this.resolveSelfEmployeeId(tenantContext);
    const requests = await this.service.getEmployeeLeaveRequests(
      tenantContext,
      employeeId,
      status,
    );
    return { success: true, data: requests };
  }

  // Was @CurrentUser()-only with no scope check at all — any authenticated
  // user holding leave.read could view any other employee's leave request by
  // guessing/incrementing the id (a genuine IDOR). The target here is a leave
  // request id, not an employee id, so it needs the resolver form rather than
  // @ScopeParam.
  @Get('requests/:id')
  @RequirePermissions('leave.read')
  @RequireScope({ resolver: LeaveRequestResolver, param: 'id' })
  async getLeaveRequest(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const request = await this.service.getLeaveRequestById(tenantContext, id);
    return { success: true, data: request };
  }

  @Get('balance')
  @RequirePermissions('leave.read')
  async getLeaveBalance(
    @TenantContextDecorator() tenantContext: TenantContext,
  ) {
    const employeeId = await this.resolveSelfEmployeeId(tenantContext);
    const balance = await this.service.getLeaveBalance(tenantContext, employeeId);
    return { success: true, data: balance };
  }

  @Get('balance/employee/:employeeId')
  @RequirePermissions('leave.read')
  @ScopeParam('employeeId')
  async getEmployeeLeaveBalance(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('employeeId') employeeId: string,
  ) {
    const balance = await this.service.getLeaveBalance(tenantContext, employeeId);
    return { success: true, data: balance };
  }

  // The service's own approver_id === approverId check (only the request's
  // direct approver, set at creation time to the manager's *users.id* — see
  // leave.service.ts createLeaveRequest — can approve it) is stricter than
  // and independent of this scope check. approver_id is a users.id (FK to
  // users, confirmed against the schema), so tenantContext.userId is passed
  // as-is here — no employees.id resolution, unlike the employee_id-based
  // routes above.
  @Put('requests/:id/approve')
  @RequirePermissions('leave.approve')
  @RequireScope({ resolver: LeaveRequestResolver, param: 'id' })
  async approveLeaveRequest(
    @TenantContextDecorator() tenantContext: TenantContext,
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

  // approver_id is a users.id (see approveLeaveRequest above) — no
  // employees.id resolution needed here either.
  @Get('approvals/pending')
  @RequirePermissions('leave.approve')
  async getPendingApprovals(
    @TenantContextDecorator() tenantContext: TenantContext,
  ) {
    const requests = await this.service.getPendingApprovals(
      tenantContext,
      tenantContext.userId,
    );
    return { success: true, data: requests };
  }

  @Get('employee/:employeeId/requests')
  @RequirePermissions('leave.read')
  @ScopeParam('employeeId')
  async getEmployeeRequests(
    @TenantContextDecorator() tenantContext: TenantContext,
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

  @Get('types')
  @RequirePermissions('leave.read')
  async getLeaveTypes(
    @TenantContextDecorator() tenantContext: TenantContext,
  ) {
    const types = await this.service.getLeaveTypes(tenantContext);
    return { success: true, data: types };
  }
}
