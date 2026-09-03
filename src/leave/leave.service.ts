import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { LeaveTypesRepository } from './leave-types.repository';
import { LeaveRequestsRepository } from './leave-requests.repository';
import { LeaveBalanceRepository } from './leave-balance.repository';
import { EmployeesRepository } from '../employees/employees.repository';
import { HolidaysRepository } from '../holidays/holidays.repository';
import { PermissionsService } from '../permissions/permissions.service';
import { TenantContext } from '../database/tenant-context';
import { AuditService } from '../audit/audit.service';
import { TransactionService } from '../database/transaction.service';
import { getFinancialYear } from '../common/util/financial-year.util';
import { parseIsoDate, toIsoDate } from '../common/util/date.util';
import {
  resolveApproverUserId,
  resolveFallbackApproverUserId,
  assertStatus,
} from '../common/approval/approval.util';
import {
  CreateLeaveRequestDto,
  HalfDayOption,
} from './dto/create-leave-request.dto';
import { ApproveLeaveRequestDto } from './dto/approve-leave-request.dto';

const APPROVE_PERMISSION = 'leave.approve';

@Injectable()
export class LeaveService {
  constructor(
    private readonly leaveTypesRepo: LeaveTypesRepository,
    private readonly leaveRequestsRepo: LeaveRequestsRepository,
    private readonly leaveBalanceRepo: LeaveBalanceRepository,
    private readonly employeesRepo: EmployeesRepository,
    private readonly holidaysRepo: HolidaysRepository,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
    private readonly transactionService: TransactionService,
  ) {}

  async createLeaveRequest(
    tenantContext: TenantContext,
    employeeId: string,
    dto: CreateLeaveRequestDto,
  ) {
    const employee = await this.employeesRepo.findById(tenantContext, employeeId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const leaveType = await this.leaveTypesRepo.findById(
      tenantContext,
      dto.leave_type_id,
    );
    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    const halfDayOption: HalfDayOption = dto.half_day_option ?? 'full_day';
    const startDate = parseIsoDate(dto.start_date);
    const endDate = parseIsoDate(dto.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate > endDate) {
      throw new BadRequestException('Start date must be on or before end date');
    }
    if (startDate < today) {
      throw new BadRequestException('Cannot apply for leave in the past');
    }
    if (halfDayOption !== 'full_day' && dto.start_date !== dto.end_date) {
      throw new BadRequestException(
        'Half-day leave must start and end on the same date',
      );
    }

    return this.transactionService.runInTransaction(async (client) => {
      const durationDays = await this.computeLeaveDuration(
        tenantContext,
        startDate,
        endDate,
        halfDayOption,
        client,
      );
      if (durationDays <= 0) {
        throw new BadRequestException(
          'The selected range contains no working days',
        );
      }

      // Double-book check, half-day aware.
      const overlapping = await this.leaveRequestsRepo.findOverlapping(
        tenantContext,
        employeeId,
        dto.start_date,
        dto.end_date,
        undefined,
        client,
      );
      const conflict = overlapping.find((ex) => {
        const exHalf = ex.half_day_option || 'full_day';
        // A full day on either side conflicts with anything on a shared date.
        if (halfDayOption === 'full_day' || exHalf === 'full_day') return true;
        // Both half-day (both single-date; SQL overlap implies the same date):
        // conflict only when it is the same half.
        return exHalf === halfDayOption;
      });
      if (conflict) {
        throw new BadRequestException(
          'This overlaps an existing leave request for the same date(s)',
        );
      }

      const requiresApproval = leaveType.requires_approval;

      // Approver = reporting manager's user, else a role-based HR/admin fallback.
      let approverUserId = await resolveApproverUserId(
        this.employeesRepo,
        tenantContext,
        employee,
        client,
      );
      if (!approverUserId && requiresApproval) {
        approverUserId = await resolveFallbackApproverUserId(
          client,
          tenantContext.organizationId,
          APPROVE_PERMISSION,
          tenantContext.userId,
        );
      }
      if (!approverUserId && requiresApproval) {
        throw new BadRequestException(
          'No approver could be determined for your leave request. Please ask HR to set your reporting manager.',
        );
      }

      const fy = this.getCurrentFinancialYear();
      const { id: balanceId, balance } = await this.getBalance(
        tenantContext,
        employeeId,
        dto.leave_type_id,
        fy,
        client,
      );
      const available =
        balance.opening_balance +
        balance.allocated +
        balance.carry_forward -
        balance.used -
        balance.pending;
      if (available < durationDays) {
        throw new BadRequestException(
          `Insufficient leave balance. Available: ${available}, requested: ${durationDays}`,
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
          half_day_option: halfDayOption,
          reason: dto.reason,
          status: requiresApproval ? 'submitted' : 'approved',
          approver_id: approverUserId ?? undefined,
          notify_user_ids: dto.notify_user_ids ?? [],
        },
        client,
      );

      if (requiresApproval) {
        // Hold the days as pending until a decision is made.
        await this.leaveBalanceRepo.updateBalance(
          tenantContext,
          balanceId,
          { pending: balance.pending + durationDays },
          client,
        );
      } else {
        // Auto-approved: consume immediately.
        await this.leaveBalanceRepo.updateBalance(
          tenantContext,
          balanceId,
          { used: balance.used + durationDays },
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
    approverUserId: string,
    dto: ApproveLeaveRequestDto,
  ) {
    const leaveRequest = await this.leaveRequestsRepo.findById(
      tenantContext,
      requestId,
    );
    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }
    if (leaveRequest.approver_id !== approverUserId) {
      throw new ForbiddenException('You are not the approver for this request');
    }
    assertStatus(leaveRequest.status, ['submitted'], 'decide on');

    return this.transactionService.runInTransaction(async (client) => {
      const oldValue = { ...leaveRequest };
      const updated = await this.leaveRequestsRepo.update(
        tenantContext,
        requestId,
        {
          status: dto.approve ? 'approved' : 'rejected',
          approved_at: dto.approve ? new Date().toISOString() : undefined,
          rejection_reason: dto.approve ? undefined : dto.rejection_reason,
        },
        client,
      );

      const fy = this.getCurrentFinancialYear();
      const found = await this.leaveBalanceRepo.findByEmployeeAndType(
        tenantContext,
        leaveRequest.employee_id,
        leaveRequest.leave_type_id,
        fy,
        client,
      );
      if (found) {
        const releasedPending = Math.max(
          0,
          found.pending - leaveRequest.duration_days,
        );
        await this.leaveBalanceRepo.updateBalance(
          tenantContext,
          found.id,
          dto.approve
            ? {
                used: found.used + leaveRequest.duration_days,
                pending: releasedPending,
              }
            : { pending: releasedPending },
          client,
        );
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

  async cancelLeaveRequest(
    tenantContext: TenantContext,
    requestId: string,
    employeeId: string,
  ) {
    const leaveRequest = await this.leaveRequestsRepo.findById(
      tenantContext,
      requestId,
    );
    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }
    if (leaveRequest.employee_id !== employeeId) {
      throw new ForbiddenException('You can only cancel your own leave requests');
    }
    assertStatus(leaveRequest.status, ['submitted', 'approved'], 'cancel');

    const startDate = parseIsoDate(leaveRequest.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (leaveRequest.status === 'approved' && startDate < today) {
      throw new BadRequestException(
        'Leave that has already started cannot be cancelled',
      );
    }

    return this.transactionService.runInTransaction(async (client) => {
      const oldValue = { ...leaveRequest };
      const updated = await this.leaveRequestsRepo.update(
        tenantContext,
        requestId,
        { status: 'cancelled', cancelled_at: new Date().toISOString() },
        client,
      );

      const fy = this.getCurrentFinancialYear();
      const found = await this.leaveBalanceRepo.findByEmployeeAndType(
        tenantContext,
        leaveRequest.employee_id,
        leaveRequest.leave_type_id,
        fy,
        client,
      );
      if (found) {
        // Release whichever bucket the days were sitting in.
        const patch =
          leaveRequest.status === 'submitted'
            ? { pending: Math.max(0, found.pending - leaveRequest.duration_days) }
            : { used: Math.max(0, found.used - leaveRequest.duration_days) };
        await this.leaveBalanceRepo.updateBalance(
          tenantContext,
          found.id,
          patch,
          client,
        );
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

  async getLeaveBalance(tenantContext: TenantContext, employeeId: string) {
    const fy = this.getCurrentFinancialYear();
    const balances = await this.leaveBalanceRepo.findByEmployee(
      tenantContext,
      employeeId,
      fy,
    );

    return balances.map((b) => ({
      ...b,
      entitled: b.opening_balance + b.allocated + b.carry_forward,
      available:
        b.opening_balance + b.allocated + b.carry_forward - b.used - b.pending,
    }));
  }

  async getEmployeeLeaveRequests(
    tenantContext: TenantContext,
    employeeId: string,
    filters?: { status?: string; from?: string; to?: string },
  ) {
    return this.leaveRequestsRepo.findByEmployee(tenantContext, employeeId, {
      status: filters?.status,
      startDate: filters?.from,
      endDate: filters?.to,
    });
  }

  async getPendingApprovals(
    tenantContext: TenantContext,
    approverUserId: string,
  ) {
    return this.leaveRequestsRepo.findPendingApprovals(
      tenantContext,
      approverUserId,
    );
  }

  /**
   * A request is visible to: its owner (the employee), its assigned approver, or
   * any user holding the `leave.approve` permission (managers / HR).
   */
  async getLeaveRequestById(tenantContext: TenantContext, requestId: string) {
    const request = await this.leaveRequestsRepo.findById(
      tenantContext,
      requestId,
    );
    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    const isOwner =
      tenantContext.employeeId != null &&
      request.employee_id === tenantContext.employeeId;
    const isApprover = request.approver_id === tenantContext.userId;

    if (!isOwner && !isApprover) {
      const perms = await this.permissionsService.getEffectivePermissions(
        tenantContext.organizationId,
        tenantContext.userId,
      );
      if (!perms.includes(APPROVE_PERMISSION)) {
        throw new ForbiddenException(
          'You are not allowed to view this leave request',
        );
      }
    }

    return request;
  }

  async getLeaveTypes(tenantContext: TenantContext) {
    return this.leaveTypesRepo.findAll(tenantContext, { status: 'active' });
  }

  /** Approved leave overlapping [from, to] across the org. */
  async getLeaveCalendar(
    tenantContext: TenantContext,
    from?: string,
    to?: string,
  ) {
    const day = new Date().toISOString().slice(0, 10);
    return this.leaveRequestsRepo.findCalendar(
      tenantContext,
      from || day,
      to || from || day,
    );
  }

  /**
   * Leave days consumed by [startDate, endDate]: weekends and mandatory
   * organisation public holidays count as 0; a `first_half` / `second_half`
   * request on a single working day counts as 0.5.
   */
  private async computeLeaveDuration(
    tenantContext: TenantContext,
    startDate: Date,
    endDate: Date,
    halfDayOption: HalfDayOption,
    executor: PoolClient,
  ): Promise<number> {
    const holidays = await this.holidaysRepo.findByOrg(
      tenantContext,
      { from: toIsoDate(startDate), to: toIsoDate(endDate) },
      executor,
    );
    // Only mandatory holidays reduce leave; optional/restricted holidays don't.
    const holidayDates = new Set(
      holidays.filter((h) => !h.is_optional).map((h) => h.holiday_date),
    );

    let workingDays = 0;
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const dow = cur.getDay(); // 0 = Sunday, 6 = Saturday
      const iso = toIsoDate(cur)!;
      if (dow !== 0 && dow !== 6 && !holidayDates.has(iso)) {
        workingDays += 1;
      }
      cur.setDate(cur.getDate() + 1);
    }

    if (halfDayOption === 'full_day') {
      return workingDays;
    }
    if (workingDays === 0) {
      throw new BadRequestException(
        'The selected date is a weekend or public holiday',
      );
    }
    return 0.5;
  }

  private getCurrentFinancialYear(): string {
    return getFinancialYear();
  }

  private async getBalance(
    tenantContext: TenantContext,
    employeeId: string,
    leaveTypeId: string,
    financialYear: string,
    client: PoolClient,
  ) {
    const balance = await this.leaveBalanceRepo.findByEmployeeAndType(
      tenantContext,
      employeeId,
      leaveTypeId,
      financialYear,
      client,
    );
    if (!balance) {
      throw new NotFoundException(
        'No leave balance is set up for this leave type',
      );
    }
    return { id: balance.id, balance };
  }
}
