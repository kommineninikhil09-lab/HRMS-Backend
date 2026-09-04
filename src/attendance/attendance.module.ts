import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { EmployeesModule } from '../employees/employees.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';

// Was an empty `@Module({})` — AttendanceController/Service/Repository all
// existed as real, complete code but were never wired in, so every
// attendance route 404'd ("Cannot POST /api/v1/attendance/mark", etc.) even
// though the app booted with no errors and "AttendanceModule dependencies
// initialized" logged successfully. Discovered while live-verifying the
// scope retrofit (§7.3) against a running server — every other pre-existing
// bug this session was found the same way, by actually exercising the
// route rather than trusting that a module with a plausible-looking name
// was wired up.
@Module({
  imports: [DatabaseModule, AuditModule, EmployeesModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceRepository],
  exports: [AttendanceService],
})
export class AttendanceModule {}
