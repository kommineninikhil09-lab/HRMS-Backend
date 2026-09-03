import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { HolidaysController } from './holidays.controller';
import { HolidaysService } from './holidays.service';
import { HolidaysRepository } from './holidays.repository';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [HolidaysController],
  providers: [HolidaysService, HolidaysRepository],
  exports: [HolidaysService, HolidaysRepository],
})
export class HolidaysModule {}
