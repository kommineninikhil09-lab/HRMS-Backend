import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AttendanceRepository, AttendanceRecord } from './attendance.repository';
import { EmployeesRepository } from '../employees/employees.repository';
import { TenantContext } from '../database/tenant-context';
import { AuditService } from '../audit/audit.service';
import { TransactionService } from '../database/transaction.service';

export interface ClockInDTO {
  notes?: string;
}

export interface ClockOutDTO {
  notes?: string;
}

export interface MarkAttendanceDTO {
  employee_id: string;
  attendance_date: string;
  status: string;
  notes?: string;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly repository: AttendanceRepository,
    private readonly employeesRepository: EmployeesRepository,
    private readonly auditService: AuditService,
    private readonly transactionService: TransactionService,
  ) {}

  async clockIn(
    tenantContext: TenantContext,
    employeeId: string,
    dto: ClockInDTO,
  ): Promise<AttendanceRecord> {
    const employee = await this.employeesRepository.findById(tenantContext, employeeId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const today = new Date().toISOString().split('T')[0];

    return this.transactionService.runInTransaction(async (client) => {
      let attendance = await this.repository.findByDate(tenantContext, employee.id, today, client);

      if (attendance && attendance.clock_in_time) {
        throw new BadRequestException('Already clocked in today');
      }

      if (!attendance) {
        attendance = await this.repository.create(
          tenantContext,
          {
            employee_id: employee.id,
            attendance_date: today,
            clock_in_time: new Date().toISOString(),
            status: 'present',
            notes: dto.notes,
          },
          client,
        );
      } else {
        attendance = await this.repository.update(
          tenantContext,
          attendance.id,
          {
            clock_in_time: new Date().toISOString(),
            status: 'present',
            notes: dto.notes,
          },
          client,
        );
      }

      await this.auditService.record(
        tenantContext,
        {
          action: 'CREATE',
          entity_type: 'Attendance',
          entity_id: attendance.id,
          new_value: attendance,
        },
        client,
      );

      return attendance;
    });
  }

  async clockOut(
    tenantContext: TenantContext,
    employeeId: string,
    dto: ClockOutDTO,
  ): Promise<AttendanceRecord> {
    const employee = await this.employeesRepository.findById(tenantContext, employeeId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const today = new Date().toISOString().split('T')[0];

    return this.transactionService.runInTransaction(async (client) => {
      const attendance = await this.repository.findByDate(tenantContext, employee.id, today, client);

      if (!attendance) {
        throw new BadRequestException('No attendance record found for today');
      }

      if (!attendance.clock_in_time) {
        throw new BadRequestException('Must clock in before clocking out');
      }

      if (attendance.clock_out_time) {
        throw new BadRequestException('Already clocked out today');
      }

      const oldValue = { ...attendance };
      const updated = await this.repository.update(
        tenantContext,
        attendance.id,
        {
          clock_out_time: new Date().toISOString(),
          notes: dto.notes,
        },
        client,
      );

      await this.auditService.record(
        tenantContext,
        {
          action: 'UPDATE',
          entity_type: 'Attendance',
          entity_id: attendance.id,
          old_value: oldValue,
          new_value: updated,
        },
        client,
      );

      return updated;
    });
  }

  async markAttendance(
    tenantContext: TenantContext,
    dto: MarkAttendanceDTO,
    markedById: string,
  ): Promise<AttendanceRecord> {
    const employee = await this.employeesRepository.findById(tenantContext, dto.employee_id);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const validStatuses = ['present', 'absent', 'half-day', 'work-from-home', 'on-leave'];
    if (!validStatuses.includes(dto.status)) {
      throw new BadRequestException(`Invalid status: ${dto.status}`);
    }

    return this.transactionService.runInTransaction(async (client) => {
      let attendance = await this.repository.findByDate(
        tenantContext,
        dto.employee_id,
        dto.attendance_date,
        client,
      );

      if (!attendance) {
        attendance = await this.repository.create(
          tenantContext,
          {
            employee_id: dto.employee_id,
            attendance_date: dto.attendance_date,
            status: dto.status,
            notes: dto.notes,
          },
          client,
        );
      } else {
        const oldValue = { ...attendance };
        attendance = await this.repository.update(
          tenantContext,
          attendance.id,
          {
            status: dto.status,
            notes: dto.notes,
          },
          client,
        );

        await this.auditService.record(
          tenantContext,
          {
            action: 'UPDATE',
            entity_type: 'Attendance',
            entity_id: attendance.id,
            old_value: oldValue,
            new_value: attendance,
          },
          client,
        );
      }

      return attendance;
    });
  }

  async getAttendanceByDate(
    tenantContext: TenantContext,
    employeeId: string,
    date: string,
  ): Promise<AttendanceRecord | null> {
    return this.repository.findByDate(tenantContext, employeeId, date);
  }

  async getAttendanceByDateRange(
    tenantContext: TenantContext,
    employeeId: string,
    startDate: string,
    endDate: string,
  ): Promise<AttendanceRecord[]> {
    return this.repository.findByDateRange(tenantContext, employeeId, startDate, endDate);
  }

  async getAttendanceSummary(
    tenantContext: TenantContext,
    employeeId: string,
    month: string,
  ) {
    return this.repository.getEmployeeAttendanceSummary(tenantContext, employeeId, month);
  }
}
