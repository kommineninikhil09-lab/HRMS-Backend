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
  ],
  exports: [PayrollService],
})
export class PayrollModule {}
