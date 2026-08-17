import { Module } from '@nestjs/common';
import { ESSController } from './ess.controller';
import { ESSService } from './ess.service';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [DatabaseModule, AuditModule, EmployeesModule],
  controllers: [ESSController],
  providers: [ESSService],
  exports: [ESSService],
})
export class ESSModule {}
