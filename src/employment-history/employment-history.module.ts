import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EmploymentHistoryRepository } from './employment-history.repository';

@Module({
  imports: [DatabaseModule],
  providers: [EmploymentHistoryRepository],
  exports: [EmploymentHistoryRepository],
})
export class EmploymentHistoryModule {}
