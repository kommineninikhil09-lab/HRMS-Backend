import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PermissionsService } from '../permissions/permissions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantContext } from '../database/tenant-context';
import { UpdateMeDto } from './dto/update-me.dto';

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
  async getCurrentUser(
    @Request() req: any,
  ): Promise<{ success: boolean; data: UserWithPermissions }> {
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
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        permissions,
      },
    };
  }

  @Patch('/me')
  async updateCurrentUser(@Request() req: any, @Body() dto: UpdateMeDto) {
    const tenantContext: TenantContext = req.tenantContext;

    const data: { firstName?: string; lastName?: string } = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;

    const user = await this.usersService.updateUser(
      tenantContext,
      tenantContext.userId,
      data,
    );

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }
}
