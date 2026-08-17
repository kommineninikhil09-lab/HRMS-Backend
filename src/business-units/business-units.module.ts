import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { BusinessUnitsController } from './business-units.controller';
import { BusinessUnitsService } from './business-units.service';
import { BusinessUnitsRepository } from './business-units.repository';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [BusinessUnitsController],
  providers: [BusinessUnitsService, BusinessUnitsRepository],
  exports: [BusinessUnitsService, BusinessUnitsRepository],
})
export class BusinessUnitsModule {}
