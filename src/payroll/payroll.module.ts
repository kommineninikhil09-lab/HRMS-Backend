import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { SalaryStructureRepository } from './repositories/salary-structure.repository';
import { SalaryComponentRepository } from './repositories/salary-component.repository';
import { SalarySlipRepository } from './repositories/salary-slip.repository';
import { SalaryAssignmentRepository } from './repositories/salary-assignment.repository';
import { StructureComponentRepository } from './repositories/structure-component.repository';
import { SlipComponentRepository } from './repositories/slip-component.repository';
import { SalarySlipResolver } from './salary-slip.resolver';

// Was an empty `@Module({})` — same pre-existing bug as AttendanceModule
// (see attendance.module.ts): PayrollController/Service/Repositories all
// existed as real, complete code but were never wired in, so every payroll
// route 404'd.
@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [PayrollController],
  providers: [
    PayrollService,
    SalaryStructureRepository,
    SalaryComponentRepository,
    SalarySlipRepository,
    SalaryAssignmentRepository,
    StructureComponentRepository,
    SlipComponentRepository,
    SalarySlipResolver,
  ],
  exports: [PayrollService],
})
export class PayrollModule {}
