import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import type { TenantContext } from '../database/tenant-context';

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Post()
  @RequirePermissions('employee.create')
  async create(@CurrentUser() tenantContext: TenantContext, @Body() dto: CreateEmployeeDto) {
    const employee = await this.service.create(tenantContext, dto);
    return { success: true, data: employee };
  }

  @Get()
  @RequirePermissions('employee.read')
  async getAll(
    @CurrentUser() tenantContext: TenantContext,
    @Query('status') status?: string,
    @Query('department_id') department_id?: string,
  ) {
    const employees = await this.service.getAll(tenantContext, { status, department_id });
    return { success: true, data: employees };
  }

  @Get(':id')
  @RequirePermissions('employee.read')
  async getById(@CurrentUser() tenantContext: TenantContext, @Param('id') id: string) {
    const employee = await this.service.getById(tenantContext, id);
    return { success: true, data: employee };
  }

  @Put(':id')
  @RequirePermissions('employee.update')
  async update(
    @CurrentUser() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const employee = await this.service.update(tenantContext, id, dto);
    return { success: true, data: employee };
  }

  @Delete(':id')
  @RequirePermissions('employee.delete')
  async delete(@CurrentUser() tenantContext: TenantContext, @Param('id') id: string) {
    await this.service.delete(tenantContext, id);
    return { success: true, message: 'Employee deleted' };
  }
}
