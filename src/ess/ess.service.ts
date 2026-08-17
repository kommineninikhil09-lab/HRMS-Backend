import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EmployeesRepository } from '../employees/employees.repository';
import { TenantContext } from '../database/tenant-context';
import { AuditService } from '../audit/audit.service';
import { TransactionService } from '../database/transaction.service';

export interface UpdateProfileDTO {
  personal_email?: string;
  phone?: string;
  dob?: string;
  gender?: string;
}

export interface EmployeeESS {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  work_email?: string;
  personal_email?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  department_id?: string;
  designation_id?: string;
  location_id?: string;
  date_of_joining?: string;
  status: string;
  manager_id?: string;
}

@Injectable()
export class ESSService {
  constructor(
    private readonly employeesRepository: EmployeesRepository,
    private readonly auditService: AuditService,
    private readonly transactionService: TransactionService,
  ) {}

  async getEmployeeProfile(tenantContext: TenantContext, employeeId: string): Promise<EmployeeESS> {
    const employee = await this.employeesRepository.findById(tenantContext, employeeId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Return only fields the employee should see in ESS
    return {
      id: employee.id,
      employee_code: employee.employee_code,
      first_name: employee.first_name,
      last_name: employee.last_name,
      work_email: employee.work_email,
      personal_email: employee.personal_email,
      phone: employee.phone,
      dob: employee.dob,
      gender: employee.gender,
      department_id: employee.department_id,
      designation_id: employee.designation_id,
      location_id: employee.location_id,
      date_of_joining: employee.date_of_joining?.toString(),
      status: employee.status,
      manager_id: employee.manager_id,
    };
  }

  async updateProfile(
    tenantContext: TenantContext,
    employeeId: string,
    dto: UpdateProfileDTO,
  ): Promise<EmployeeESS> {
    const employee = await this.employeesRepository.findById(tenantContext, employeeId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.transactionService.runInTransaction(async (client) => {
      const oldValue = {
        personal_email: employee.personal_email,
        phone: employee.phone,
        dob: employee.dob,
      };

      const updated = await this.employeesRepository.update(
        tenantContext,
        employeeId,
        {
          personal_email: dto.personal_email || employee.personal_email,
          phone: dto.phone || employee.phone,
          dob: dto.dob || employee.dob,
          gender: dto.gender || employee.gender,
        },
        client,
      );

      await this.auditService.record(
        tenantContext,
        {
          action: 'UPDATE',
          entity_type: 'Employee',
          entity_id: employeeId,
          old_value: oldValue,
          new_value: {
            personal_email: dto.personal_email,
            phone: dto.phone,
            dob: dto.dob,
            gender: dto.gender,
          },
        },
        client,
      );

      return this.getEmployeeProfile(tenantContext, employeeId);
    });
  }

  async getEmployeeDashboard(tenantContext: TenantContext, employeeId: string) {
    const employee = await this.getEmployeeProfile(tenantContext, employeeId);

    return {
      profile: employee,
      stats: {
        employeeCode: employee.employee_code,
        status: employee.status,
        dateOfJoining: employee.date_of_joining,
        currentMonth: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
      },
    };
  }

  async getEmployeeDocuments(tenantContext: TenantContext, employeeId: string) {
    // This will fetch documents from employee_documents table
    // Implementation depends on document storage setup
    return {
      documents: [],
      message: 'Document management coming soon',
    };
  }
}
