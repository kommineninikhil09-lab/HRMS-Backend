import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantContextDecorator, type TenantContext } from '../database/tenant-context';

@Controller('payroll')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // Salary Structures
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

  // Salary Slips
  @Get('slips/:id')
  @RequirePermissions('payroll.read')
  async getSalarySlip(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const slip = await this.payrollService.getSalarySlip(tenantContext, id);
    return { success: true, data: slip };
  }

  @Get('employee/:employeeId/slips')
  @RequirePermissions('payroll.read')
  async getEmployeeSalarySlips(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('employeeId') employeeId: string,
  ) {
    const slips = await this.payrollService.getEmployeeSalarySlips(tenantContext, employeeId);
    return { success: true, data: slips };
  }

  @Put('slips/:id/approve')
  @RequirePermissions('payroll.approve')
  async approveSalarySlip(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const slip = await this.payrollService.approveSalarySlip(tenantContext, id);
    return { success: true, data: slip };
  }

  @Put('slips/:id/mark-paid')
  @RequirePermissions('payroll.approve')
  async markSalarySlipAsPaid(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const slip = await this.payrollService.markSalarySlipAsPaid(tenantContext, id);
    return { success: true, data: slip };
  }

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
  async getSlipWithBreakdown(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const slip = await this.payrollService.getSlipWithBreakdown(tenantContext, id);
    return { success: true, data: slip };
  }
}
