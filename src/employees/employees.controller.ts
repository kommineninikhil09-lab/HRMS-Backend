import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ScopeParam } from '../common/authorization/scope-param.decorator';
// Was @CurrentUser() (returns the raw request.user JWT payload, which
// happens to coincidentally share an `organizationId` field but has no
// `scopedEmployeeIds`) — this controller needs the actual tenantContext
// object that ScopeGuard mutates for list routes. Several other controllers
// (attendance, payroll, performance) already use the correct decorator;
// this one just hadn't been touched until the scope retrofit needed it.
import { TenantContextDecorator, type TenantContext } from '../database/tenant-context';

// No `@UseGuards(JwtAuthGuard, PermissionsGuard)` here — both already run
// globally (registered as APP_GUARD in app.module.ts). The duplicate
// controller-level registration that used to be here was harmless before
// (just a redundant second permission check), but it actively broke list
// filtering once ScopeGuard existed: JwtAuthGuard.handleRequest
// unconditionally *rebuilds* `request.tenantContext` from the JWT on every
// invocation, so running it a second time silently wiped out the
// `scopedEmployeeIds` the global ScopeGuard had just attached — verified by
// the list endpoint returning every employee regardless of caller scope
// until this was removed, while the single-target scope check on GET/PUT/
// DELETE :id kept working the whole time (that decision is made inside the
// guard itself, before the duplicate ever ran).
@Controller('employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Post()
  // Was 'employee.write', which doesn't exist as a permission — nobody,
  // including Admin, could ever create an employee. The real seeded codes
  // are the split employee.create/update/delete (confirmed against the
  // permissions table directly, not assumed).
  @RequirePermissions('employee.create')
  async create(@TenantContextDecorator() tenantContext: TenantContext, @Body() dto: CreateEmployeeDto) {
    const employee = await this.service.create(tenantContext, dto);
    return { success: true, data: employee };
  }

  @Get()
  @RequirePermissions('employee.read')
  async getAll(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Query('status') status?: string,
    @Query('department_id') department_id?: string,
  ) {
    const employees = await this.service.getAll(tenantContext, { status, department_id });
    return { success: true, data: employees };
  }

  @Get(':id')
  @RequirePermissions('employee.read')
  @ScopeParam('id')
  async getById(@TenantContextDecorator() tenantContext: TenantContext, @Param('id') id: string) {
    const employee = await this.service.getById(tenantContext, id);
    return { success: true, data: employee };
  }

  @Put(':id')
  @RequirePermissions('employee.update')
  @ScopeParam('id')
  async update(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const employee = await this.service.update(tenantContext, id, dto);
    return { success: true, data: employee };
  }

  @Delete(':id')
  @RequirePermissions('employee.delete')
  @ScopeParam('id')
  async delete(@TenantContextDecorator() tenantContext: TenantContext, @Param('id') id: string) {
    await this.service.delete(tenantContext, id);
    return { success: true, message: 'Employee deleted' };
  }
}
