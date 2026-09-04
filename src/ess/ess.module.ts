import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { EmployeesModule } from '../employees/employees.module';
import { ESSController } from './ess.controller';
import { ESSService } from './ess.service';

// Was an empty `@Module({})` — same pre-existing bug as AttendanceModule
// (see attendance.module.ts): ESSController/Service existed as real,
// complete code but were never wired in, so every ESS route 404'd.
@Module({
  imports: [DatabaseModule, AuditModule, EmployeesModule],
  controllers: [ESSController],
  providers: [ESSService],
  exports: [ESSService],
})
export class ESSModule {}
