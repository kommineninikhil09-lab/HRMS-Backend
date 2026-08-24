import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Guard that checks if user has Super Admin role
 * Only allows access to Super Admin users
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantContext = request.tenantContext;

    if (!user) {
      throw new ForbiddenException('User not found in request');
    }

    // Check if user has Super Admin role
    // This will be implemented after we add role loading to JWT
    // For now, this is a placeholder that will be filled in later
    const hasSuperAdminRole = user.roles?.some(
      (role: any) => role.name === 'Super Admin',
    );

    if (!hasSuperAdminRole) {
      throw new ForbiddenException(
        'Access denied. Super Admin role required.',
      );
    }

    return true;
  }
}
