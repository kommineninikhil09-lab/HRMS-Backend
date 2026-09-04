import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { EmployeesModule } from '../employees/employees.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { LeaveModule } from '../leave/leave.module';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    EmployeesModule,
    HolidaysModule,
    // Attendance reads approved leave to tell "on leave" apart from "absent".
    LeaveModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceRepository],
  exports: [AttendanceService, AttendanceRepository],
})
export class AttendanceModule {}
