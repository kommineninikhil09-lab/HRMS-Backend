import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { LeaveTypesRepository } from './leave-types.repository';
import { LeaveRequestsRepository } from './leave-requests.repository';
import { LeaveBalanceRepository } from './leave-balance.repository';
import { EmployeesRepository } from '../employees/employees.repository';
import { TenantContext } from '../database/tenant-context';
import { AuditService } from '../audit/audit.service';
import { TransactionService } from '../database/transaction.service';
import { Pool, PoolClient } from 'pg';

export interface CreateLeaveRequestDTO {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

export interface ApproveLeaveRequestDTO {
  approve: boolean;
  rejection_reason?: string;
}

@Injectable()
export class LeaveService {
  constructor(
    private readonly leaveTypesRepo: LeaveTypesRepository,
    private readonly leaveRequestsRepo: LeaveRequestsRepository,
    private readonly leaveBalanceRepo: LeaveBalanceRepository,
    private readonly employeesRepo: EmployeesRepository,
    private readonly auditService: AuditService,
    private readonly transactionService: TransactionService,
  ) {}

  async createLeaveRequest(
    tenantContext: TenantContext,
    employeeId: string,
    dto: CreateLeaveRequestDTO,
  ) {
    const employee = await this.employeesRepo.findById(tenantContext, employeeId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const leaveType = await this.leaveTypesRepo.findById(tenantContext, dto.leave_type_id);
    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);

    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    if (startDate < new Date()) {
      throw new BadRequestException('Cannot apply for past dates');
    }

    const durationDays = this.calculateBusinessDays(startDate, endDate);

    // leave_requests.approver_id is a FK to users(id), not employees(id)
    // (confirmed against the schema) — but employee.manager_id is an
    // employees.id (self-referencing FK within employees). Storing
    // manager_id directly always violated the FK constraint for any
    // employee with a manager assigned, so no leave request could ever be
    // created for them; confirmed live. The manager's own user_id is what
    // belongs here.
    const manager = employee.manager_id
      ? await this.employeesRepo.findById(tenantContext, employee.manager_id)
      : null;
    const approverUserId = manager?.user_id;

    return this.transactionService.runInTransaction(async (client) => {
      const currentYear = this.getCurrentFinancialYear();
      const availableBalance = await this.leaveBalanceRepo.getAvailableBalance(
        tenantContext,
        employeeId,
        dto.leave_type_id,
        currentYear,
        client,
      );

      if (availableBalance < durationDays) {
        throw new BadRequestException(
          `Insufficient leave balance. Available: ${availableBalance}, Requested: ${durationDays}`,
        );
      }

      const leaveRequest = await this.leaveRequestsRepo.create(
        tenantContext,
        {
          employee_id: employeeId,
          leave_type_id: dto.leave_type_id,
          start_date: dto.start_date,
          end_date: dto.end_date,
          duration_days: durationDays,
          reason: dto.reason,
          status: leaveType.requires_approval ? 'submitted' : 'approved',
          approver_id: approverUserId,
        },
        client,
      );

      if (!leaveType.requires_approval) {
        await this.leaveBalanceRepo.updateBalance(
          tenantContext,
          await this.getBalanceId(tenantContext, employeeId, dto.leave_type_id, currentYear, client),
          { pending: availableBalance - durationDays },
          client,
        );
      }

      await this.auditService.record(
        tenantContext,
        {
          action: 'CREATE',
          entity_type: 'LeaveRequest',
          entity_id: leaveRequest.id,
          new_value: leaveRequest,
        },
        client,
      );

      return leaveRequest;
    });
  }

  async approveLeaveRequest(
    tenantContext: TenantContext,
    requestId: string,
    approverId: string,
    dto: ApproveLeaveRequestDTO,
  ) {
    const leaveRequest = await this.leaveRequestsRepo.findById(tenantContext, requestId);
    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.approver_id !== approverId) {
      throw new ForbiddenException('You are not authorized to approve this request');
    }

    if (leaveRequest.status !== 'submitted') {
      throw new BadRequestException('Leave request cannot be approved in current status');
    }

    return this.transactionService.runInTransaction(async (client) => {
      const status = dto.approve ? 'approved' : 'rejected';
      const oldValue = { ...leaveRequest };

      const updated = await this.leaveRequestsRepo.update(
        tenantContext,
        requestId,
        {
          status,
          approved_at: dto.approve ? new Date().toISOString() : undefined,
          rejection_reason: dto.approve ? undefined : dto.rejection_reason,
        },
        client,
      );

      if (dto.approve) {
        const currentYear = this.getCurrentFinancialYear();
        const balanceId = await this.getBalanceId(
          tenantContext,
          leaveRequest.employee_id,
          leaveRequest.leave_type_id,
          currentYear,
          client,
        );

        const currentBalance = await this.leaveBalanceRepo.findByEmployeeAndType(
          tenantContext,
          leaveRequest.employee_id,
          leaveRequest.leave_type_id,
          currentYear,
          client,
        );

        if (currentBalance) {
          await this.leaveBalanceRepo.updateBalance(
            tenantContext,
            balanceId,
            {
              used: currentBalance.used + leaveRequest.duration_days,
              pending: currentBalance.pending - leaveRequest.duration_days,
            },
            client,
          );
        }
      }

      await this.auditService.record(
        tenantContext,
        {
          action: 'UPDATE',
          entity_type: 'LeaveRequest',
          entity_id: requestId,
          old_value: oldValue,
          new_value: updated,
        },
        client,
      );

      return updated;
    });
  }

  async getLeaveBalance(
    tenantContext: TenantContext,
    employeeId: string,
  ) {
    const currentYear = this.getCurrentFinancialYear();
    const balances = await this.leaveBalanceRepo.findByEmployee(
      tenantContext,
      employeeId,
      currentYear,
    );

    return balances.map((balance) => ({
      ...balance,
      available: balance.allocated + balance.carry_forward - balance.used - balance.pending,
    }));
  }

  async getEmployeeLeaveRequests(
    tenantContext: TenantContext,
    employeeId: string,
    status?: string,
  ) {
    return this.leaveRequestsRepo.findByEmployee(tenantContext, employeeId, { status });
  }

  async getPendingApprovals(
    tenantContext: TenantContext,
    approverId: string,
  ) {
    return this.leaveRequestsRepo.findPendingApprovals(tenantContext, approverId);
  }

  async getLeaveRequestById(
    tenantContext: TenantContext,
    requestId: string,
  ) {
    const request = await this.leaveRequestsRepo.findById(tenantContext, requestId);
    if (!request) {
      throw new NotFoundException('Leave request not found');
    }
    return request;
  }

  async getLeaveTypes(tenantContext: TenantContext) {
    return this.leaveTypesRepo.findAll(tenantContext);
  }

  private calculateBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const curDate = new Date(startDate);

    while (curDate <= endDate) {
      const dayOfWeek = curDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
      curDate.setDate(curDate.getDate() + 1);
    }

    return count;
  }

  private getCurrentFinancialYear(): number {
    const today = new Date();
    const year = today.getFullYear();
    return year;
  }

  private async getBalanceId(
    tenantContext: TenantContext,
    employeeId: string,
    leaveTypeId: string,
    financialYear: number,
    client: PoolClient,
  ): Promise<string> {
    const balance = await this.leaveBalanceRepo.findByEmployeeAndType(
      tenantContext,
      employeeId,
      leaveTypeId,
      financialYear,
      client,
    );

    if (!balance) {
      throw new NotFoundException('Leave balance record not found');
    }

    return balance.id;
  }
}
