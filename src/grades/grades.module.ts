import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { GradesRepository } from './grades.repository';
import { GradesService } from './grades.service';
import { GradesController } from './grades.controller';

@Module({
  imports: [AuditModule],
  controllers: [GradesController],
  providers: [GradesRepository, GradesService],
  exports: [GradesService],
})
export class GradesModule {}
