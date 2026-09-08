import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { ScopeService } from './scope.service';

/**
 * Shared authorization-scope module: resolves effective permissions + the
 * per-request {@link import('../../database/tenant-context').ManagementScope},
 * and owns `manager_scopes` CRUD.
 *
 * `@Global()` because `JwtAuthGuard` / `PermissionsGuard` depend on it and are
 * applied (via `@UseGuards`) in every domain module — mirroring how the
 * database pool is provided. Import it once in `AppModule`.
 */
@Global()
@Module({
  imports: [AuditModule],
  providers: [ScopeService],
  exports: [ScopeService],
})
export class ScopeModule {}
