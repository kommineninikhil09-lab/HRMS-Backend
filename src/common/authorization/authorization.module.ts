import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { EmployeesModule } from '../../employees/employees.module';
import { ScopeService } from './scope.service';

@Module({
  imports: [DatabaseModule, EmployeesModule],
  providers: [ScopeService],
  exports: [ScopeService],
})
export class AuthorizationModule {}
