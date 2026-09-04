import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { EmployeesRepository } from './employees.repository';
import { EmploymentHistoryRepository } from '../employment-history/employment-history.repository';
import { TenantContext } from '../database/tenant-context';
import { AuditService } from '../audit/audit.service';
import { TransactionService } from '../database/transaction.service';

export interface CreateEmployeeDTO {
  employee_code: string;
  first_name: string;
  last_name: string;
  work_email?: string;
  personal_email?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  department_id?: string;
  location_id?: string;
  designation_id?: string;
  manager_id?: string;
  date_of_joining: string;
  employment_type?: string;
}

export interface UpdateEmployeeDTO {
  first_name?: string;
  last_name?: string;
  work_email?: string;
  phone?: string;
  department_id?: string;
  location_id?: string;
  designation_id?: string;
  manager_id?: string;
  status?: string;
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly repository: EmployeesRepository,
    private readonly historyRepository: EmploymentHistoryRepository,
    private readonly auditService: AuditService,
    private readonly transactionService: TransactionService,
  ) {}

  async create(tenantContext: TenantContext, dto: CreateEmployeeDTO) {
    const existing = await this.repository.findByCode(tenantContext, dto.employee_code);
    if (existing) {
      throw new BadRequestException(`Employee code '${dto.employee_code}' already exists`);
    }

    if (dto.work_email) {
      const withEmail = await this.repository.findByEmail(tenantContext, dto.work_email);
      if (withEmail) {
        throw new BadRequestException(`Work email already in use`);
      }
    }

    return this.transactionService.runInTransaction(async (client) => {
      // Convert DTO fields to repository format
      const employeeData = {
        ...dto,
        date_of_joining: new Date(dto.date_of_joining),
        // dob stays as string (date string format)
      };
      const employee = await this.repository.create(tenantContext, employeeData, client);

      await this.historyRepository.record(tenantContext, {
        employee_id: employee.id,
        event_type: 'joining',
        effective_date: new Date(dto.date_of_joining),
        new_value: employee,
        reason: 'Employee joined',
      }, client);

      await this.auditService.record(tenantContext, {
        action: 'CREATE',
        entity_type: 'Employee',
        entity_id: employee.id,
        new_value: employee,
      }, client);

      return employee;
    });
  }

  async getById(tenantContext: TenantContext, id: string) {
    const employee = await this.repository.findById(tenantContext, id);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }

  async getAll(tenantContext: TenantContext, filters?: { status?: string; department_id?: string }) {
    return this.repository.findAll(tenantContext, { ...filters, scopedIds: tenantContext.scopedEmployeeIds });
  }

  async update(tenantContext: TenantContext, id: string, dto: UpdateEmployeeDTO) {
    const employee = await this.repository.findById(tenantContext, id);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (dto.work_email && dto.work_email !== employee.work_email) {
      const withEmail = await this.repository.findByEmail(tenantContext, dto.work_email);
      if (withEmail) {
        throw new BadRequestException(`Work email already in use`);
      }
    }

    return this.transactionService.runInTransaction(async (client) => {
      const oldValue = { ...employee };
      const updated = await this.repository.update(tenantContext, id, dto, client);

      if (dto.status && dto.status !== employee.status) {
        await this.historyRepository.record(tenantContext, {
          employee_id: id,
          event_type: 'status_change',
          effective_date: new Date(),
          previous_value: { status: oldValue.status },
          new_value: { status: dto.status },
          reason: `Status changed to ${dto.status}`,
        }, client);
      }

      if (dto.department_id && dto.department_id !== employee.department_id) {
        await this.historyRepository.record(tenantContext, {
          employee_id: id,
          event_type: 'transfer',
          effective_date: new Date(),
          previous_value: { department_id: oldValue.department_id },
          new_value: { department_id: dto.department_id },
          reason: 'Department transfer',
        }, client);
      }

      await this.auditService.record(tenantContext, {
        action: 'UPDATE',
        entity_type: 'Employee',
        entity_id: id,
        old_value: oldValue,
        new_value: updated,
      }, client);

      return updated;
    });
  }

  async delete(tenantContext: TenantContext, id: string) {
    const employee = await this.repository.findById(tenantContext, id);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.transactionService.runInTransaction(async (client) => {
      await this.auditService.record(tenantContext, {
        action: 'DELETE',
        entity_type: 'Employee',
        entity_id: id,
        old_value: employee,
      }, client);

      await this.repository.delete(tenantContext, id, client);
    });
  }

  /** Resolve the employee record for the currently authenticated user. */
  async getByUserId(tenantContext: TenantContext, userId: string) {
    return this.repository.findByUserId(tenantContext, userId);
  }

  /** Direct reports of `managerEmployeeId` — no recursion. */
  async getDirectReportIds(tenantContext: TenantContext, managerEmployeeId: string) {
    return this.repository.findDirectReportIds(tenantContext, managerEmployeeId);
  }

  /** Full recursive subtree under `managerEmployeeId` (cycle- and depth-safe). */
  async getSubtreeIds(tenantContext: TenantContext, managerEmployeeId: string) {
    return this.repository.findSubtreeIds(tenantContext, managerEmployeeId);
  }
}
