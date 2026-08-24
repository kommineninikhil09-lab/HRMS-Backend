import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DepartmentsRepository } from './departments.repository';
import { DepartmentsService } from './departments.service';
import { DepartmentsController } from './departments.controller';

@Module({
  imports: [AuditModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsRepository, DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
