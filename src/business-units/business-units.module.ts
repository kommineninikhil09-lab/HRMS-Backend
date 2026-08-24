import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BusinessUnitsRepository } from './business-units.repository';
import { BusinessUnitsService } from './business-units.service';
import { BusinessUnitsController } from './business-units.controller';

@Module({
  imports: [AuditModule],
  controllers: [BusinessUnitsController],
  providers: [BusinessUnitsRepository, BusinessUnitsService],
  exports: [BusinessUnitsService],
})
export class BusinessUnitsModule {}
