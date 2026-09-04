import {
  Module,
  NestModule,
  MiddlewareConsumer,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE, APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { BusinessUnitsModule } from './business-units/business-units.module';
import { LocationsModule } from './locations/locations.module';
import { DepartmentsModule } from './departments/departments.module';
import { TeamsModule } from './teams/teams.module';
import { GradesModule } from './grades/grades.module';
import { DesignationsModule } from './designations/designations.module';
import { CostCentersModule } from './cost-centers/cost-centers.module';
import { EmploymentHistoryModule } from './employment-history/employment-history.module';
import { EmployeesModule } from './employees/employees.module';
import { AuthorizationModule } from './common/authorization/authorization.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveModule } from './leave/leave.module';
import { ESSModule } from './ess/ess.module';
import { PayrollModule } from './payroll/payroll.module';
import { PerformanceModule } from './performance/performance.module';
import { CommunityModule } from './community/community.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),
    DatabaseModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    OrganizationsModule,
    BusinessUnitsModule,
    LocationsModule,
    DepartmentsModule,
    TeamsModule,
    GradesModule,
    DesignationsModule,
    CostCentersModule,
    EmploymentHistoryModule,
    EmployeesModule,
    AuthorizationModule,
    AttendanceModule,
    LeaveModule,
    ESSModule,
    PayrollModule,
    PerformanceModule,
    CommunityModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    // ScopeGuard is NOT registered here — it's registered as an APP_GUARD
    // from within AuthorizationModule itself (see that file's comment for
    // why: it needs ScopeService, a same-module dependency there, and every
    // way of wiring that cross-module from AppModule instead was verified
    // broken against a live server). APP_GUARD is a global multi-token Nest
    // collects from every module, so it's still active for every route.
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
