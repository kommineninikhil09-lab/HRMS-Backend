import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AttendanceRepository, AttendanceRecord } from './attendance.repository';
import { EmployeesRepository } from '../employees/employees.repository';
import { LeaveRequestsRepository } from '../leave/leave-requests.repository';
import { HolidaysRepository } from '../holidays/holidays.repository';
import { TenantContext } from '../database/tenant-context';
import { AuditService } from '../audit/audit.service';
import { TransactionService } from '../database/transaction.service';
import { parseIsoDate, toIsoDate } from '../common/util/date.util';
import {
  attendanceDateFor,
  monthRange,
} from '../common/util/attendance-date.util';
import {
  CheckInDto,
  CheckOutDto,
  AttendanceQueryDto,
  AdminAttendanceQueryDto,
  MarkAttendanceDto,
} from './dto/attendance.dto';

/** A single calendar day, resolved against records + leave + holidays. */
export interface AttendanceDayView {
  attendance_date: string;
  /**
   * `present` / `work_from_home` / `half_day` — from an actual record.
   * `on_leave` — covered by approved leave, no record.
   * `holiday` / `weekend` — non-working day, no record.
   * `absent` — a past working day with no record and no leave.
   * `not_marked` — today or a future working day with no record yet.
   */
  status:
    | 'present'
    | 'work_from_home'
    | 'half_day'
    | 'on_leave'
    | 'holiday'
    | 'weekend'
    | 'absent'
    | 'not_marked';
  check_in: string | null;
  check_out: string | null;
  working_minutes: number | null;
  late_minutes: number | null;
  early_leave_minutes: number | null;
  is_weekend: boolean;
  is_holiday: boolean;
  holiday_name: string | null;
  on_leave: boolean;
  leave_type_name: string | null;
  source: string | null;
  notes: string | null;
  record_id: string | null;
}

export interface AttendanceSummary {
  from: string;
  to: string;
  /** Days in the window up to and including today (future days excluded). */
  elapsed_days: number;
  total_days: number;
  weekend_days: number;
  holiday_days: number;
  /** Expected working days in the window (total − weekends − holidays). */
  working_days: number;
  present_days: number;
  leave_days: number;
  absent_days: number;
  /** Rows with a positive `late_minutes` — always 0 until a schedule exists. */
  late_days: number;
  total_working_minutes: number;
  total_working_hours: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_DAYS = 366;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly repository: AttendanceRepository,
    private readonly employeesRepository: EmployeesRepository,
    private readonly leaveRequestsRepository: LeaveRequestsRepository,
    private readonly holidaysRepository: HolidaysRepository,
    private readonly auditService: AuditService,
    private readonly transactionService: TransactionService,
  ) {}

  // ---------------------------------------------------------------------------
  // Check-in / check-out / today
  // ---------------------------------------------------------------------------

  async checkIn(
    tenantContext: TenantContext,
    employeeId: string,
    dto: CheckInDto,
  ): Promise<AttendanceRecord> {
    await this.assertEmployeeInOrg(tenantContext, employeeId);
    const today = await this.orgToday(tenantContext);

    return this.transactionService.runInTransaction(async (client) => {
      const existing = await this.repository.findByDate(
        tenantContext,
        employeeId,
        today,
        client,
      );

      if (existing?.clock_in_time) {
        throw new BadRequestException('You have already checked in today');
      }

      const now = new Date().toISOString();
      // No work-schedule configuration exists, so no reliable "late" can be
      // derived — the row is simply Present. `late_minutes` stays NULL.
      const record = existing
        ? await this.repository.update(
            tenantContext,
            existing.id,
            {
              clock_in_time: now,
              status: 'present',
              source: 'web',
              notes: dto.notes ?? existing.notes,
            },
            client,
          )
        : await this.repository.create(
            tenantContext,
            {
              employee_id: employeeId,
              attendance_date: today,
              clock_in_time: now,
              status: 'present',
              source: 'web',
              notes: dto.notes,
            },
            client,
          );

      await this.auditService.record(
        tenantContext,
        {
          action: existing ? 'UPDATE' : 'CREATE',
          entity_type: 'Attendance',
          entity_id: record.id,
          new_value: record,
        },
        client,
      );

      return record;
    });
  }

  async checkOut(
    tenantContext: TenantContext,
    employeeId: string,
    dto: CheckOutDto,
  ): Promise<AttendanceRecord> {
    await this.assertEmployeeInOrg(tenantContext, employeeId);
    const today = await this.orgToday(tenantContext);

    return this.transactionService.runInTransaction(async (client) => {
      const existing = await this.repository.findByDate(
        tenantContext,
        employeeId,
        today,
        client,
      );

      if (!existing || !existing.clock_in_time) {
        throw new BadRequestException('You must check in before checking out');
      }
      if (existing.clock_out_time) {
        throw new BadRequestException('You have already checked out today');
      }

      const now = new Date();
      const workingMinutes = Math.max(
        0,
        Math.round(
          (now.getTime() - new Date(existing.clock_in_time).getTime()) / 60000,
        ),
      );

      const oldValue = { ...existing };
      const updated = await this.repository.update(
        tenantContext,
        existing.id,
        {
          clock_out_time: now.toISOString(),
          working_minutes: workingMinutes,
          notes: dto.notes ?? existing.notes,
        },
        client,
      );

      await this.auditService.record(
        tenantContext,
        {
          action: 'UPDATE',
          entity_type: 'Attendance',
          entity_id: existing.id,
          old_value: oldValue,
          new_value: updated,
        },
        client,
      );

      return updated;
    });
  }

  /** Today's day-view for the current employee (or any employee, for HR). */
  async getToday(
    tenantContext: TenantContext,
    employeeId: string,
  ): Promise<AttendanceDayView> {
    await this.assertEmployeeInOrg(tenantContext, employeeId);
    const today = await this.orgToday(tenantContext);
    const views = await this.buildDayViews(
      tenantContext,
      employeeId,
      today,
      today,
      today,
    );
    return views[0];
  }

  // ---------------------------------------------------------------------------
  // History / summary
  // ---------------------------------------------------------------------------

  async getHistory(
    tenantContext: TenantContext,
    employeeId: string,
    query: AttendanceQueryDto,
  ): Promise<AttendanceDayView[]> {
    await this.assertEmployeeInOrg(tenantContext, employeeId);
    const { from, to } = await this.resolveWindow(tenantContext, query);
    const today = await this.orgToday(tenantContext);
    return this.buildDayViews(tenantContext, employeeId, from, to, today);
  }

  async getSummary(
    tenantContext: TenantContext,
    employeeId: string,
    query: AttendanceQueryDto,
  ): Promise<AttendanceSummary> {
    await this.assertEmployeeInOrg(tenantContext, employeeId);
    const { from, to } = await this.resolveWindow(tenantContext, query);
    const today = await this.orgToday(tenantContext);
    const views = await this.buildDayViews(
      tenantContext,
      employeeId,
      from,
      to,
      today,
    );
    return this.summarize(from, to, today, views);
  }

  // ---------------------------------------------------------------------------
  // Admin / HR
  // ---------------------------------------------------------------------------

  /** Actual attendance records across the org for a date (default: today) or window. */
  async adminList(
    tenantContext: TenantContext,
    query: AdminAttendanceQueryDto,
  ): Promise<AttendanceRecord[]> {
    let from: string;
    let to: string;

    if (query.date) {
      from = to = query.date;
    } else if (query.month) {
      ({ from, to } = monthRange(query.month));
    } else if (query.from && query.to) {
      from = query.from;
      to = query.to;
    } else {
      from = to = await this.orgToday(tenantContext);
    }

    this.assertRange(from, to);

    if (query.employeeId) {
      await this.assertEmployeeInOrg(tenantContext, query.employeeId);
    }

    return this.repository.findForOrg(tenantContext, {
      from,
      to,
      employeeId: query.employeeId,
      status: query.status,
    });
  }

  adminEmployeeHistory(
    tenantContext: TenantContext,
    employeeId: string,
    query: AttendanceQueryDto,
  ): Promise<AttendanceDayView[]> {
    return this.getHistory(tenantContext, employeeId, query);
  }

  adminEmployeeSummary(
    tenantContext: TenantContext,
    employeeId: string,
    query: AttendanceQueryDto,
  ): Promise<AttendanceSummary> {
    return this.getSummary(tenantContext, employeeId, query);
  }

  /** HR marks / overrides one employee's attendance for a date. */
  async markAttendance(
    tenantContext: TenantContext,
    dto: MarkAttendanceDto,
    markedByUserId: string,
  ): Promise<AttendanceRecord> {
    await this.assertEmployeeInOrg(tenantContext, dto.employee_id);

    return this.transactionService.runInTransaction(async (client) => {
      const existing = await this.repository.findByDate(
        tenantContext,
        dto.employee_id,
        dto.attendance_date,
        client,
      );

      if (!existing) {
        const created = await this.repository.create(
          tenantContext,
          {
            employee_id: dto.employee_id,
            attendance_date: dto.attendance_date,
            status: dto.status,
            source: 'admin',
            notes: dto.notes,
            marked_by: markedByUserId,
          },
          client,
        );
        await this.auditService.record(
          tenantContext,
          {
            action: 'CREATE',
            entity_type: 'Attendance',
            entity_id: created.id,
            new_value: created,
          },
          client,
        );
        return created;
      }

      const oldValue = { ...existing };
      const updated = await this.repository.update(
        tenantContext,
        existing.id,
        {
          status: dto.status,
          source: 'admin',
          notes: dto.notes ?? existing.notes,
          marked_by: markedByUserId,
        },
        client,
      );
      await this.auditService.record(
        tenantContext,
        {
          action: 'UPDATE',
          entity_type: 'Attendance',
          entity_id: existing.id,
          old_value: oldValue,
          new_value: updated,
        },
        client,
      );
      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async orgToday(tenantContext: TenantContext): Promise<string> {
    const tz = await this.repository.getOrganizationTimezone(
      tenantContext.organizationId,
    );
    return attendanceDateFor(tz);
  }

  private async assertEmployeeInOrg(
    tenantContext: TenantContext,
    employeeId: string,
  ): Promise<void> {
    // `findById` is organisation-scoped, so this also blocks cross-org access.
    const employee = await this.employeesRepository.findById(
      tenantContext,
      employeeId,
    );
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
  }

  private assertRange(from: string, to: string): void {
    if (from > to) {
      throw new BadRequestException('"from" must be on or before "to"');
    }
    const span =
      (parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS + 1;
    if (span > MAX_WINDOW_DAYS) {
      throw new BadRequestException(
        `Date window too large (max ${MAX_WINDOW_DAYS} days)`,
      );
    }
  }

  private async resolveWindow(
    tenantContext: TenantContext,
    query: AttendanceQueryDto,
  ): Promise<{ from: string; to: string }> {
    let from: string;
    let to: string;

    if (query.month) {
      ({ from, to } = monthRange(query.month));
    } else if (query.from && query.to) {
      from = query.from;
      to = query.to;
    } else if (query.from || query.to) {
      throw new BadRequestException(
        'Provide both "from" and "to", or use "month"',
      );
    } else {
      ({ from, to } = monthRange((await this.orgToday(tenantContext)).slice(0, 7)));
    }

    this.assertRange(from, to);
    return { from, to };
  }

  /**
   * Resolve each calendar day in [from, to] against actual records, approved
   * leave and public holidays. Weekends = Sat/Sun (the app-wide assumption,
   * shared with F4 leave). Only mandatory holidays are non-working; optional
   * holidays are treated as normal days.
   */
  private async buildDayViews(
    tenantContext: TenantContext,
    employeeId: string,
    from: string,
    to: string,
    todayIso: string,
  ): Promise<AttendanceDayView[]> {
    const [records, holidays, approvedLeave] = await Promise.all([
      this.repository.findByDateRange(tenantContext, employeeId, from, to),
      this.holidaysRepository.findByOrg(tenantContext, { from, to }),
      this.leaveRequestsRepository.findApprovedForEmployeeInRange(
        tenantContext,
        employeeId,
        from,
        to,
      ),
    ]);

    const recordByDate = new Map(records.map((r) => [r.attendance_date, r]));
    const holidayByDate = new Map(
      holidays.filter((h) => !h.is_optional).map((h) => [h.holiday_date, h.name]),
    );

    // date → { name, fraction } for approved leave (fraction 0.5 for half-day).
    const leaveByDate = new Map<string, { name: string; fraction: number }>();
    for (const lr of approvedLeave) {
      const fraction = lr.half_day_option !== 'full_day' ? 0.5 : 1;
      const cur = parseIsoDate(lr.start_date);
      const end = parseIsoDate(lr.end_date);
      while (cur <= end) {
        const iso = toIsoDate(cur)!;
        if (iso >= from && iso <= to) {
          leaveByDate.set(iso, {
            name: lr.leave_type_name ?? 'Leave',
            fraction,
          });
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    const views: AttendanceDayView[] = [];
    const cursor = parseIsoDate(from);
    const last = parseIsoDate(to);

    while (cursor <= last) {
      const iso = toIsoDate(cursor)!;
      const dow = cursor.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const holidayName = holidayByDate.get(iso) ?? null;
      const isHoliday = holidayName !== null;
      const leave = leaveByDate.get(iso) ?? null;
      const record = recordByDate.get(iso) ?? null;

      let status: AttendanceDayView['status'];
      if (record && record.clock_in_time) {
        status =
          record.status === 'work_from_home'
            ? 'work_from_home'
            : record.status === 'half_day'
              ? 'half_day'
              : 'present';
      } else if (record && record.status === 'on_leave') {
        status = 'on_leave';
      } else if (leave) {
        status = 'on_leave';
      } else if (isHoliday) {
        status = 'holiday';
      } else if (isWeekend) {
        status = 'weekend';
      } else if (iso < todayIso) {
        status = 'absent';
      } else {
        status = 'not_marked';
      }

      views.push({
        attendance_date: iso,
        status,
        check_in: record?.clock_in_time ?? null,
        check_out: record?.clock_out_time ?? null,
        working_minutes: record?.working_minutes ?? null,
        late_minutes: record?.late_minutes ?? null,
        early_leave_minutes: record?.early_leave_minutes ?? null,
        is_weekend: isWeekend,
        is_holiday: isHoliday,
        holiday_name: holidayName,
        on_leave: leave !== null,
        leave_type_name: leave?.name ?? null,
        source: record?.source ?? null,
        notes: record?.notes ?? null,
        record_id: record?.id ?? null,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    // Newest first, matching the leave history convention.
    return views.reverse();
  }

  private summarize(
    from: string,
    to: string,
    todayIso: string,
    views: AttendanceDayView[],
  ): AttendanceSummary {
    let weekend = 0;
    let holiday = 0;
    let working = 0;
    let present = 0;
    let leave = 0;
    let absent = 0;
    let lateDays = 0;
    let workingMinutes = 0;
    let elapsed = 0;

    for (const v of views) {
      const isPast = v.attendance_date <= todayIso;
      if (isPast) elapsed += 1;

      if (v.working_minutes) workingMinutes += v.working_minutes;
      if (v.late_minutes && v.late_minutes > 0) lateDays += 1;

      if (v.is_weekend && !v.is_holiday) {
        weekend += 1;
        continue;
      }
      if (v.is_holiday) {
        holiday += 1;
        continue;
      }

      // Working day.
      working += 1;
      if (v.status === 'present' || v.status === 'work_from_home') {
        present += 1;
      } else if (v.status === 'half_day') {
        present += 0.5;
        if (v.on_leave) leave += 0.5;
      } else if (v.status === 'on_leave') {
        leave += 1;
      } else if (v.status === 'absent') {
        absent += 1;
      }
    }

    return {
      from,
      to,
      elapsed_days: elapsed,
      total_days: views.length,
      weekend_days: weekend,
      holiday_days: holiday,
      working_days: working,
      present_days: round1(present),
      leave_days: round1(leave),
      absent_days: round1(absent),
      late_days: lateDays,
      total_working_minutes: workingMinutes,
      total_working_hours: Math.round((workingMinutes / 60) * 100) / 100,
    };
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
