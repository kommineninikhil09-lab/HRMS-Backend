import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ScopeParam } from '../common/authorization/scope-param.decorator';
import { RequireScope } from '../common/authorization/require-scope.decorator';
import { SalarySlipResolver } from './salary-slip.resolver';
import { TenantContextDecorator, type TenantContext } from '../database/tenant-context';

// No class-level @UseGuards(JwtAuthGuard, PermissionsGuard) — both already
// run globally. Same redundant-registration bug fixed in employees/
// attendance/leave controllers: it silently wipes out scopedEmployeeIds
// ScopeGuard attaches to tenantContext, which the pending/approved list
// routes below now depend on.
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // Salary Structures/Components are org-level payroll configuration
  // (templates, not employee data) — no employee target, so no scope check,
  // same as leave.types/attendance's non-employee routes.
  @Post('structures')
  @RequirePermissions('payroll.write')
  async createSalaryStructure(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Body() dto: any,
  ) {
    const structure = await this.payrollService.createSalaryStructure(tenantContext, dto);
    return { success: true, data: structure };
  }

  @Get('structures')
  @RequirePermissions('payroll.read')
  async getSalaryStructures(@TenantContextDecorator() tenantContext: TenantContext) {
    const structures = await this.payrollService.getSalaryStructures(tenantContext);
    return { success: true, data: structures };
  }

  @Get('structures/:id')
  @RequirePermissions('payroll.read')
  async getSalaryStructure(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const structure = await this.payrollService.getSalaryStructure(tenantContext, id);
    return { success: true, data: structure };
  }

  @Put('structures/:id')
  @RequirePermissions('payroll.write')
  async updateSalaryStructure(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const structure = await this.payrollService.updateSalaryStructure(tenantContext, id, dto);
    return { success: true, data: structure };
  }

  // Salary Components
  @Post('components')
  @RequirePermissions('payroll.write')
  async createSalaryComponent(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Body() dto: any,
  ) {
    const component = await this.payrollService.createSalaryComponent(tenantContext, dto);
    return { success: true, data: component };
  }

  @Get('components')
  @RequirePermissions('payroll.read')
  async getSalaryComponents(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Query('type') type?: string,
  ) {
    if (type) {
      const components = await this.payrollService.getSalaryComponentsByType(
        tenantContext,
        type as any,
      );
      return { success: true, data: components };
    }
    const components = await this.payrollService.getSalaryComponents(tenantContext);
    return { success: true, data: components };
  }

  @Get('components/:id')
  @RequirePermissions('payroll.read')
  async getSalaryComponent(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const component = await this.payrollService.getSalaryComponent(tenantContext, id);
    return { success: true, data: component };
  }

  // Salary Slips — each slip belongs to one employee (an IDOR previously:
  // any payroll.read holder could view any employee's slip, including its
  // gross/net amounts, by guessing the id), so slip-id routes resolve to
  // that employee via SalarySlipResolver.
  @Get('slips/:id')
  @RequirePermissions('payroll.read')
  @RequireScope({ resolver: SalarySlipResolver, param: 'id' })
  async getSalarySlip(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const slip = await this.payrollService.getSalarySlip(tenantContext, id);
    return { success: true, data: slip };
  }

  @Get('employee/:employeeId/slips')
  @RequirePermissions('payroll.read')
  @ScopeParam('employeeId')
  async getEmployeeSalarySlips(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('employeeId') employeeId: string,
  ) {
    const slips = await this.payrollService.getEmployeeSalarySlips(tenantContext, employeeId);
    return { success: true, data: slips };
  }

  @Put('slips/:id/approve')
  @RequirePermissions('payroll.approve')
  @RequireScope({ resolver: SalarySlipResolver, param: 'id' })
  async approveSalarySlip(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const slip = await this.payrollService.approveSalarySlip(tenantContext, id);
    return { success: true, data: slip };
  }

  @Put('slips/:id/mark-paid')
  @RequirePermissions('payroll.approve')
  @RequireScope({ resolver: SalarySlipResolver, param: 'id' })
  async markSalarySlipAsPaid(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const slip = await this.payrollService.markSalarySlipAsPaid(tenantContext, id);
    return { success: true, data: slip };
  }

  // List routes (no @ScopeParam/@RequireScope) — ScopeGuard attaches
  // tenantContext.scopedEmployeeIds, and the repository now filters on it
  // (see salary-slip.repository.ts findByStatus), so an HR Manager only
  // sees their team's pending/approved slips instead of the whole org's.
  @Get('slips/pending/approvals')
  @RequirePermissions('payroll.approve')
  async getPendingApprovals(@TenantContextDecorator() tenantContext: TenantContext) {
    const slips = await this.payrollService.getPendingApprovals(tenantContext);
    return { success: true, data: slips };
  }

  @Get('slips/approved/list')
  @RequirePermissions('payroll.read')
  async getApprovedSlips(@TenantContextDecorator() tenantContext: TenantContext) {
    const slips = await this.payrollService.getApprovedSlips(tenantContext);
    return { success: true, data: slips };
  }

  // Salary Assignments
  @Post('assignments')
  @RequirePermissions('payroll.write')
  @ScopeParam('employee_id')
  async assignStructureToEmployee(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Body() dto: any,
  ) {
    const assignment = await this.payrollService.assignStructureToEmployee(
      tenantContext,
      dto.employee_id,
      dto.structure_id,
      dto.effective_date,
    );
    return { success: true, data: assignment };
  }

  @Get('assignments/employee/:employeeId')
  @RequirePermissions('payroll.read')
  @ScopeParam('employeeId')
  async getEmployeeSalaryAssignment(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('employeeId') employeeId: string,
  ) {
    const assignment = await this.payrollService.getEmployeeSalaryAssignment(
      tenantContext,
      employeeId,
    );
    return { success: true, data: assignment };
  }

  @Get('assignments/employee/:employeeId/history')
  @RequirePermissions('payroll.read')
  @ScopeParam('employeeId')
  async getEmployeeAssignmentHistory(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('employeeId') employeeId: string,
  ) {
    const history = await this.payrollService.getEmployeeAssignmentHistory(
      tenantContext,
      employeeId,
    );
    return { success: true, data: history };
  }

  // Salary Slip Generation
  @Post('slips/generate')
  @RequirePermissions('payroll.process')
  @ScopeParam('employee_id')
  async generateSalarySlip(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Body() dto: any,
  ) {
    const slip = await this.payrollService.generateSalarySlip(
      tenantContext,
      dto.employee_id,
      dto.month,
      dto.pay_cycle_id,
    );
    return { success: true, data: slip };
  }

  @Get('slips/:id/breakdown')
  @RequirePermissions('payroll.read')
  @RequireScope({ resolver: SalarySlipResolver, param: 'id' })
  async getSlipWithBreakdown(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const slip = await this.payrollService.getSlipWithBreakdown(tenantContext, id);
    return { success: true, data: slip };
  }
}
