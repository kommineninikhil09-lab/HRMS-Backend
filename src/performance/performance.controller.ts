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
import { PerformanceService } from './performance.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantContextDecorator, type TenantContext } from '../database/tenant-context';

@Controller('performance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  // Performance Cycles
  @Post('cycles')
  @RequirePermissions('performance.cycles')
  async createCycle(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Body() dto: any,
  ) {
    const cycle = await this.performanceService.createCycle(tenantContext, dto);
    return { success: true, data: cycle };
  }

  @Get('cycles')
  @RequirePermissions('performance.read')
  async getCycles(@TenantContextDecorator() tenantContext: TenantContext) {
    const cycles = await this.performanceService.getCycles(tenantContext);
    return { success: true, data: cycles };
  }

  @Get('cycles/:id')
  @RequirePermissions('performance.read')
  async getCycle(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const cycle = await this.performanceService.getCycle(tenantContext, id);
    return { success: true, data: cycle };
  }

  @Put('cycles/:id')
  @RequirePermissions('performance.cycles')
  async updateCycle(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const cycle = await this.performanceService.updateCycle(tenantContext, id, dto);
    return { success: true, data: cycle };
  }

  // Appraisal Templates
  @Post('templates')
  @RequirePermissions('performance.templates')
  async createTemplate(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Body() dto: any,
  ) {
    const template = await this.performanceService.createTemplate(tenantContext, dto);
    return { success: true, data: template };
  }

  @Get('templates')
  @RequirePermissions('performance.read')
  async getTemplates(@TenantContextDecorator() tenantContext: TenantContext) {
    const templates = await this.performanceService.getTemplates(tenantContext);
    return { success: true, data: templates };
  }

  @Get('templates/:id')
  @RequirePermissions('performance.read')
  async getTemplate(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const template = await this.performanceService.getTemplate(tenantContext, id);
    return { success: true, data: template };
  }

  @Put('templates/:id')
  @RequirePermissions('performance.templates')
  async updateTemplate(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const template = await this.performanceService.updateTemplate(tenantContext, id, dto);
    return { success: true, data: template };
  }

  // Performance Appraisals
  @Post('appraisals')
  @RequirePermissions('performance.write')
  async createAppraisal(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Body() dto: any,
  ) {
    const appraisal = await this.performanceService.createAppraisal(tenantContext, dto);
    return { success: true, data: appraisal };
  }

  @Get('appraisals')
  @RequirePermissions('performance.read')
  async getAppraisals(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Query('cycle_id') cycleId?: string,
    @Query('status') status?: string,
    @Query('employee_id') employeeId?: string,
  ) {
    const appraisals = await this.performanceService.getAppraisals(tenantContext, {
      cycle_id: cycleId,
      status,
      employee_id: employeeId,
    });
    return { success: true, data: appraisals };
  }

  @Get('appraisals/:id')
  @RequirePermissions('performance.read')
  async getAppraisal(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const appraisal = await this.performanceService.getAppraisal(tenantContext, id);
    return { success: true, data: appraisal };
  }

  // Rating Submission
  @Post('appraisals/:id/ratings')
  @RequirePermissions('performance.rate')
  async submitRating(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') appraisalId: string,
    @Body() dto: any,
  ) {
    const rating = await this.performanceService.submitRating(tenantContext, appraisalId, dto);
    return { success: true, data: rating };
  }

  // Appraisal Workflow
  @Put('appraisals/:id/submit')
  @RequirePermissions('performance.write')
  async submitAppraisal(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const appraisal = await this.performanceService.submitAppraisal(tenantContext, id);
    return { success: true, data: appraisal };
  }

  @Put('appraisals/:id/review')
  @RequirePermissions('performance.review')
  async reviewAppraisal(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const appraisal = await this.performanceService.reviewAppraisal(tenantContext, id, dto);
    return { success: true, data: appraisal };
  }

  @Put('appraisals/:id/finalize')
  @RequirePermissions('performance.finalize')
  async finalizeAppraisal(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const appraisal = await this.performanceService.finalizeAppraisal(tenantContext, id);
    return { success: true, data: appraisal };
  }

  // Goals
  @Post('goals')
  @RequirePermissions('performance.goals.write')
  async createGoal(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Body() dto: any,
  ) {
    const goal = await this.performanceService.createGoal(tenantContext, dto);
    return { success: true, data: goal };
  }

  @Put('goals/:id')
  @RequirePermissions('performance.goals.write')
  async updateGoal(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const goal = await this.performanceService.updateGoal(tenantContext, id, dto);
    return { success: true, data: goal };
  }

  @Get('employee/:employeeId/goals')
  @RequirePermissions('performance.goals.read')
  async getEmployeeGoals(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('employeeId') employeeId: string,
  ) {
    const goals = await this.performanceService.getEmployeeGoals(tenantContext, employeeId);
    return { success: true, data: goals };
  }

  // Competencies
  @Post('competencies')
  @RequirePermissions('performance.templates')
  async createCompetency(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Body() dto: any,
  ) {
    const competency = await this.performanceService.createCompetency(tenantContext, dto);
    return { success: true, data: competency };
  }

  @Get('competencies')
  @RequirePermissions('performance.read')
  async getCompetencies(@TenantContextDecorator() tenantContext: TenantContext) {
    const competencies = await this.performanceService.getCompetencies(tenantContext);
    return { success: true, data: competencies };
  }

  @Get('competencies/:id')
  @RequirePermissions('performance.read')
  async getCompetency(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
  ) {
    const competency = await this.performanceService.getCompetency(tenantContext, id);
    return { success: true, data: competency };
  }
}
