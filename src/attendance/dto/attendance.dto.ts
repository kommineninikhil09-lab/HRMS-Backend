import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

/** Statuses an employee/HR can persist on an attendance row. */
export const ATTENDANCE_STATUSES = [
  'present',
  'absent',
  'half_day',
  'on_leave',
  'work_from_home',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

const MONTH = /^\d{4}-\d{2}$/;

export class CheckInDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CheckOutDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Employee history / summary window: `month=YYYY-MM` OR `from`+`to` ISO dates. */
export class AttendanceQueryDto {
  @IsOptional()
  @Matches(MONTH, { message: 'month must be in YYYY-MM format' })
  month?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be an ISO date (YYYY-MM-DD)' })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be an ISO date (YYYY-MM-DD)' })
  to?: string;
}

/** Admin list filters. `date` selects a single day; otherwise `from`/`to`/`month`. */
export class AdminAttendanceQueryDto extends AttendanceQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be an ISO date (YYYY-MM-DD)' })
  date?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsIn(ATTENDANCE_STATUSES)
  status?: AttendanceStatus;
}

/** HR marks/overrides one employee's attendance for a specific date. */
export class MarkAttendanceDto {
  @IsUUID()
  employee_id!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'attendance_date must be an ISO date (YYYY-MM-DD)',
  })
  attendance_date!: string;

  @IsIn(ATTENDANCE_STATUSES)
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
