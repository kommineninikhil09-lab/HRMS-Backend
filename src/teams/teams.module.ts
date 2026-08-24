import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TeamsRepository } from './teams.repository';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';

@Module({
  imports: [AuditModule],
  controllers: [TeamsController],
  providers: [TeamsRepository, TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
