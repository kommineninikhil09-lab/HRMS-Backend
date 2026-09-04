import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../../database/database.module';
import { EmployeesModule } from '../../employees/employees.module';
import { ScopeService } from './scope.service';
import { ScopeGuard } from './scope.guard';

/**
 * APP_GUARD is a global multi-provider token — Nest scans for it across
 * *every* module, not just the root. Registering ScopeGuard here (instead of
 * in app.module.ts) means its constructor dependency on ScopeService
 * resolves through completely ordinary same-module DI, with no cross-module
 * resolution involved at all.
 *
 * This replaces three earlier attempts that were each verified broken
 * against a live server (registering the binding in AppModule instead, via
 * useClass / useExisting / a useFactory manually walking moduleRef.get()
 * down through every transitive dependency by hand) — all either silently
 * injected `undefined` somewhere in the chain or were silently never invoked
 * by Nest's guard pipeline at all, with no error either way. Doing it this
 * way avoids the whole failure class rather than working around it.
 */
@Module({
  imports: [DatabaseModule, EmployeesModule],
  providers: [
    ScopeService,
    {
      provide: APP_GUARD,
      useClass: ScopeGuard,
    },
  ],
  exports: [ScopeService],
})
export class AuthorizationModule {}
