import { Module } from '@nestjs/common';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { LeaveTypesRepository } from './leave-types.repository';
import { LeaveRequestsRepository } from './leave-requests.repository';
import { LeaveBalanceRepository } from './leave-balance.repository';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [DatabaseModule, AuditModule, EmployeesModule],
  controllers: [LeaveController],
  providers: [
    LeaveService,
    LeaveTypesRepository,
    LeaveRequestsRepository,
    LeaveBalanceRepository,
  ],
  exports: [
    LeaveService,
    LeaveTypesRepository,
    LeaveRequestsRepository,
    LeaveBalanceRepository,
  ],
})
export class LeaveModule {}
