import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CostCentersRepository } from './cost-centers.repository';
import { CostCentersService } from './cost-centers.service';
import { CostCentersController } from './cost-centers.controller';

@Module({
  imports: [AuditModule],
  controllers: [CostCentersController],
  providers: [CostCentersRepository, CostCentersService],
  exports: [CostCentersService],
})
export class CostCentersModule {}
