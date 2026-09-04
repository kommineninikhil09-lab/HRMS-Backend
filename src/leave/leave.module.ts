import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { EmployeesModule } from '../employees/employees.module';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { LeaveTypesRepository } from './leave-types.repository';
import { LeaveRequestsRepository } from './leave-requests.repository';
import { LeaveBalanceRepository } from './leave-balance.repository';

// Was an empty `@Module({})` — same pre-existing bug as AttendanceModule
// (see attendance.module.ts): LeaveController/Service/Repositories all
// existed as real, complete code but were never wired in, so every leave
// route 404'd. Discovered while auditing the other modules implementation.md
// claims are "existing/working" after finding the same bug in Attendance.
@Module({
  imports: [DatabaseModule, AuditModule, EmployeesModule],
  controllers: [LeaveController],
  providers: [LeaveService, LeaveTypesRepository, LeaveRequestsRepository, LeaveBalanceRepository],
  exports: [LeaveService],
})
export class LeaveModule {}
