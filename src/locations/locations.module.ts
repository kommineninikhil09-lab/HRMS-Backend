import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LocationsRepository } from './locations.repository';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';

@Module({
  imports: [AuditModule],
  controllers: [LocationsController],
  providers: [LocationsRepository, LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
