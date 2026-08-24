import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DesignationsRepository } from './designations.repository';
import { DesignationsService } from './designations.service';
import { DesignationsController } from './designations.controller';

@Module({
  imports: [AuditModule],
  controllers: [DesignationsController],
  providers: [DesignationsRepository, DesignationsService],
  exports: [DesignationsService],
})
export class DesignationsModule {}
