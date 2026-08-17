import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditRepository } from './audit.repository';
import { AuditController } from './audit.controller';

@Module({
  providers: [AuditService, AuditRepository],
  exports: [AuditService, AuditRepository],
  controllers: [AuditController],
})
export class AuditModule {}
