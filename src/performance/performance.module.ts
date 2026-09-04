import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { PerformanceCycleRepository } from './repositories/performance-cycle.repository';
import { AppraisalTemplateRepository } from './repositories/appraisal-template.repository';
import { PerformanceAppraisalRepository } from './repositories/performance-appraisal.repository';
import { AppraisalRatingRepository } from './repositories/appraisal-rating.repository';
import { CompetencyRepository } from './repositories/competency.repository';
import { PerformanceGoalRepository } from './repositories/performance-goal.repository';
import { PerformanceAppraisalResolver } from './performance-appraisal.resolver';
import { PerformanceGoalResolver } from './performance-goal.resolver';

// Was an empty `@Module({})` — same pre-existing bug as AttendanceModule
// (see attendance.module.ts): PerformanceController/Service/Repositories
// all existed as real, complete code but were never wired in, so every
// performance route 404'd.
@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [PerformanceController],
  providers: [
    PerformanceService,
    PerformanceCycleRepository,
    AppraisalTemplateRepository,
    PerformanceAppraisalRepository,
    AppraisalRatingRepository,
    CompetencyRepository,
    PerformanceGoalRepository,
    PerformanceAppraisalResolver,
    PerformanceGoalResolver,
  ],
  exports: [PerformanceService],
})
export class PerformanceModule {}
