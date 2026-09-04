import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantContext } from '../database/tenant-context';
import { TransactionService } from '../database/transaction.service';
import { AuditService } from '../audit/audit.service';
import { SalaryStructureRepository } from './repositories/salary-structure.repository';
import { SalaryComponentRepository } from './repositories/salary-component.repository';
import { SalarySlipRepository } from './repositories/salary-slip.repository';
import { SalaryAssignmentRepository } from './repositories/salary-assignment.repository';
import { StructureComponentRepository } from './repositories/structure-component.repository';
import { SlipComponentRepository } from './repositories/slip-component.repository';

export interface CreateSalaryStructureDTO {
  name: string;
  code: string;
  description?: string;
}

export interface CreateSalaryComponentDTO {
  name: string;
  code: string;
  component_type: 'earnings' | 'deduction' | 'tax';
  description?: string;
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly structureRepository: SalaryStructureRepository,
    private readonly componentRepository: SalaryComponentRepository,
    private readonly salarySlipRepository: SalarySlipRepository,
    private readonly assignmentRepository: SalaryAssignmentRepository,
    private readonly structureComponentRepository: StructureComponentRepository,
    private readonly slipComponentRepository: SlipComponentRepository,
    private readonly auditService: AuditService,
    private readonly transactionService: TransactionService,
  ) {}

  // Salary Structure Operations
  async createSalaryStructure(
    tenantContext: TenantContext,
    dto: CreateSalaryStructureDTO,
  ) {
    const structure = await this.structureRepository.create(tenantContext, {
      organization_id: tenantContext.organizationId,
      name: dto.name,
      code: dto.code,
      description: dto.description,
      is_active: true,
    });

    await this.auditService.record(tenantContext, {
      action: 'CREATE',
      entity_type: 'SalaryStructure',
      entity_id: structure.id,
      new_value: structure,
    });

    return structure;
  }

  async getSalaryStructures(tenantContext: TenantContext) {
    return this.structureRepository.findAll(tenantContext);
  }

  async getSalaryStructure(tenantContext: TenantContext, id: string) {
    const structure = await this.structureRepository.findById(tenantContext, id);
    if (!structure) {
      throw new NotFoundException('Salary structure not found');
    }
    return structure;
  }

  async updateSalaryStructure(
    tenantContext: TenantContext,
    id: string,
    dto: Partial<CreateSalaryStructureDTO>,
  ) {
    const old = await this.structureRepository.findById(tenantContext, id);
    if (!old) {
      throw new NotFoundException('Salary structure not found');
    }

    const updated = await this.structureRepository.update(tenantContext, id, {
      name: dto.name,
      code: dto.code,
      description: dto.description,
    });

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'SalaryStructure',
      entity_id: id,
      old_value: old,
      new_value: updated,
    });

    return updated;
  }

  // Salary Component Operations
  async createSalaryComponent(
    tenantContext: TenantContext,
    dto: CreateSalaryComponentDTO,
  ) {
    const component = await this.componentRepository.create(tenantContext, {
      organization_id: tenantContext.organizationId,
      name: dto.name,
      code: dto.code,
      component_type: dto.component_type,
      description: dto.description,
      is_active: true,
    });

    await this.auditService.record(tenantContext, {
      action: 'CREATE',
      entity_type: 'SalaryComponent',
      entity_id: component.id,
      new_value: component,
    });

    return component;
  }

  async getSalaryComponents(tenantContext: TenantContext) {
    return this.componentRepository.findAll(tenantContext);
  }

  async getSalaryComponent(tenantContext: TenantContext, id: string) {
    const component = await this.componentRepository.findById(tenantContext, id);
    if (!component) {
      throw new NotFoundException('Salary component not found');
    }
    return component;
  }

  async getSalaryComponentsByType(
    tenantContext: TenantContext,
    type: 'earnings' | 'deduction' | 'tax',
  ) {
    return this.componentRepository.findByType(tenantContext, type);
  }

  // Salary Slip Operations
  async getSalarySlip(tenantContext: TenantContext, id: string) {
    const slip = await this.salarySlipRepository.findById(tenantContext, id);
    if (!slip) {
      throw new NotFoundException('Salary slip not found');
    }
    return slip;
  }

  async getEmployeeSalarySlips(tenantContext: TenantContext, employeeId: string) {
    return this.salarySlipRepository.findByEmployeeAndYear(
      tenantContext,
      employeeId,
      new Date().getFullYear().toString(),
    );
  }

  async approveSalarySlip(tenantContext: TenantContext, slipId: string) {
    const slip = await this.salarySlipRepository.findById(tenantContext, slipId);
    if (!slip) {
      throw new NotFoundException('Salary slip not found');
    }

    if (slip.status !== 'draft') {
      throw new BadRequestException('Only draft slips can be approved');
    }

    const updated = await this.salarySlipRepository.update(tenantContext, slipId, {
      status: 'approved',
      approved_by: tenantContext.userId,
      approved_at: new Date(),
    });

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'SalarySlip',
      entity_id: slipId,
      old_value: slip,
      new_value: updated,
    });

    return updated;
  }

  async markSalarySlipAsPaid(tenantContext: TenantContext, slipId: string) {
    const slip = await this.salarySlipRepository.findById(tenantContext, slipId);
    if (!slip) {
      throw new NotFoundException('Salary slip not found');
    }

    if (slip.status !== 'approved') {
      throw new BadRequestException('Only approved slips can be marked as paid');
    }

    const updated = await this.salarySlipRepository.update(tenantContext, slipId, {
      status: 'paid',
      paid_at: new Date(),
    });

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'SalarySlip',
      entity_id: slipId,
      old_value: slip,
      new_value: updated,
    });

    return updated;
  }

  async getPendingApprovals(tenantContext: TenantContext) {
    return this.salarySlipRepository.findByStatus(tenantContext, 'draft', tenantContext.scopedEmployeeIds);
  }

  async getApprovedSlips(tenantContext: TenantContext) {
    return this.salarySlipRepository.findByStatus(tenantContext, 'approved', tenantContext.scopedEmployeeIds);
  }

  // Salary Assignment Operations
  async assignStructureToEmployee(
    tenantContext: TenantContext,
    employeeId: string,
    structureId: string,
    effectiveDate: string,
  ) {
    const structure = await this.structureRepository.findById(tenantContext, structureId);
    if (!structure) {
      throw new NotFoundException('Salary structure not found');
    }

    const assignment = await this.assignmentRepository.create(tenantContext, {
      organization_id: tenantContext.organizationId,
      employee_id: employeeId,
      structure_id: structureId,
      effective_date: new Date(effectiveDate),
      status: 'active',
    });

    await this.auditService.record(tenantContext, {
      action: 'CREATE',
      entity_type: 'SalaryAssignment',
      entity_id: assignment.id,
      new_value: assignment,
    });

    return assignment;
  }

  async getEmployeeSalaryAssignment(tenantContext: TenantContext, employeeId: string) {
    return this.assignmentRepository.findActiveByEmployee(tenantContext, employeeId);
  }

  async getEmployeeAssignmentHistory(tenantContext: TenantContext, employeeId: string) {
    return this.assignmentRepository.findByEmployee(tenantContext, employeeId);
  }

  // Salary Slip Generation
  async generateSalarySlip(
    tenantContext: TenantContext,
    employeeId: string,
    month: string,
    payCycleId: string,
  ) {
    const assignment = await this.assignmentRepository.findActiveByEmployee(
      tenantContext,
      employeeId,
    );

    if (!assignment) {
      throw new NotFoundException(
        'No active salary structure assignment found for this employee',
      );
    }

    const components = await this.structureComponentRepository.findByStructure(
      tenantContext,
      assignment.structure_id,
    );

    if (components.length === 0) {
      throw new BadRequestException('Salary structure has no components defined');
    }

    let grossAmount = 0;
    let totalDeductions = 0;

    return this.transactionService.runInTransaction(async (client) => {
      const slip = await this.salarySlipRepository.create(
        tenantContext,
        {
          organization_id: tenantContext.organizationId,
          employee_id: employeeId,
          pay_cycle_id: payCycleId,
          month,
          gross_amount: 0,
          total_deductions: 0,
          net_amount: 0,
          status: 'draft',
        },
        client,
      );

      for (const component of components) {
        const amount = component.amount || 0;
        const componentType = (component.component_type || 'deduction') as 'earnings' | 'deduction' | 'tax';

        await this.slipComponentRepository.addComponentToSlip(
          tenantContext,
          slip.id,
          component.component_id,
          component.component_name || 'Unknown Component',
          componentType,
          amount,
          client,
        );

        if (componentType === 'earnings') {
          grossAmount += amount;
        } else {
          totalDeductions += amount;
        }
      }

      const netAmount = grossAmount - totalDeductions;

      const updatedSlip = await this.salarySlipRepository.update(
        tenantContext,
        slip.id,
        {
          gross_amount: grossAmount,
          total_deductions: totalDeductions,
          net_amount: netAmount,
        },
        client,
      );

      await this.auditService.record(
        tenantContext,
        {
          action: 'CREATE',
          entity_type: 'SalarySlip',
          entity_id: slip.id,
          new_value: updatedSlip,
        },
        client,
      );

      return updatedSlip;
    });
  }

  async getSlipWithBreakdown(tenantContext: TenantContext, slipId: string) {
    const slip = await this.salarySlipRepository.findById(tenantContext, slipId);
    if (!slip) {
      throw new NotFoundException('Salary slip not found');
    }

    const components = await this.slipComponentRepository.getSlipBreakdown(
      tenantContext,
      slipId,
    );

    return {
      ...slip,
      components,
    };
  }
}
