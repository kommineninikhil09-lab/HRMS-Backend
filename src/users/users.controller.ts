import { Body, Controller, Get, Patch, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { PermissionsService } from '../permissions/permissions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantContext } from '../database/tenant-context';
import { UpdateUserDto } from './dto/update-user.dto';

interface UserWithPermissions {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: { id: string; name: string }[];
  permissions: string[];
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private permissionsService: PermissionsService,
  ) {}

  @Get('/me')
  async getCurrentUser(@Request() req: any): Promise<UserWithPermissions> {
    const tenantContext: TenantContext = req.tenantContext;

    const user = await this.usersService.getUserById(
      tenantContext,
      tenantContext.userId,
    );

    const roles = await this.permissionsService.getUserRoles(
      tenantContext.organizationId,
      tenantContext.userId,
    );

    const permissions = await this.permissionsService.getEffectivePermissions(
      tenantContext.organizationId,
      tenantContext.userId,
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions,
    };
  }

  @Patch('/me')
  async updateCurrentUser(
    @Request() req: any,
    @Body() dto: UpdateUserDto,
  ): Promise<{ id: string; email: string; firstName: string | null; lastName: string | null }> {
    const tenantContext: TenantContext = req.tenantContext;

    // Self-service update: only firstName/lastName are accepted here, and the
    // target is always the caller's own id — status changes (e.g. re-enabling
    // a disabled account) must go through the admin employee-management flow.
    const user = await this.usersService.updateUser(
      tenantContext,
      tenantContext.userId,
      {
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}
