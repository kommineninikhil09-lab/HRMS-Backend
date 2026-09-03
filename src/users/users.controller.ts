import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  UseGuards,
  Request,
  Param,
  Body,
  Query,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PermissionsService } from '../permissions/permissions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
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

interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  status?: 'active' | 'inactive';
}

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private permissionsService: PermissionsService,
  ) {}

  // ---- self-service (any authenticated user) ----

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

  // ---- administration (permission-gated) ----

  @Get('/admin/users')
  @RequirePermissions('user.read')
  async listUsers(
    @Request() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const tenantContext: TenantContext = req.tenantContext;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    const users = await this.usersService.listUsers(
      tenantContext,
      limitNum,
      (pageNum - 1) * limitNum,
    );

    const userList = await Promise.all(
      users.users.map(async (user) => {
        const roles = await this.permissionsService.getUserRoles(
          tenantContext.organizationId,
          user.id,
        );
        const permissions =
          await this.permissionsService.getEffectivePermissions(
            tenantContext.organizationId,
            user.id,
          );

        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles,
          permissions,
        };
      }),
    );

    return {
      users: userList,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: users.total,
        totalPages: Math.ceil(users.total / limitNum),
      },
    };
  }

  @Get('/admin/users/:id')
  @RequirePermissions('user.read')
  async getUserDetail(
    @Request() req: any,
    @Param('id') userId: string,
  ): Promise<UserWithPermissions> {
    const tenantContext: TenantContext = req.tenantContext;

    const user = await this.usersService.getUserById(tenantContext, userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = await this.permissionsService.getUserRoles(
      tenantContext.organizationId,
      userId,
    );
    const permissions = await this.permissionsService.getEffectivePermissions(
      tenantContext.organizationId,
      userId,
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

  @Post('/admin/users')
  @RequirePermissions('user.create')
  async createUser(
    @Request() req: any,
    @Body() createUserDto: CreateUserDto,
  ): Promise<UserWithPermissions> {
    const tenantContext: TenantContext = req.tenantContext;

    if (!createUserDto.email || !createUserDto.password) {
      throw new BadRequestException('Email and password required');
    }

    const user = await this.usersService.createUser(
      tenantContext,
      createUserDto.email,
      createUserDto.firstName,
      createUserDto.lastName,
      createUserDto.password,
    );

    const roles = await this.permissionsService.getUserRoles(
      tenantContext.organizationId,
      user.id,
    );
    const permissions = await this.permissionsService.getEffectivePermissions(
      tenantContext.organizationId,
      user.id,
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

  @Put('/admin/users/:id')
  @RequirePermissions('user.update')
  async updateUser(
    @Request() req: any,
    @Param('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserWithPermissions> {
    const tenantContext: TenantContext = req.tenantContext;

    const user = await this.usersService.updateUser(
      tenantContext,
      userId,
      updateUserDto,
    );

    const roles = await this.permissionsService.getUserRoles(
      tenantContext.organizationId,
      user.id,
    );
    const permissions = await this.permissionsService.getEffectivePermissions(
      tenantContext.organizationId,
      user.id,
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

  @Delete('/admin/users/:id')
  @RequirePermissions('user.delete')
  async deleteUser(
    @Request() req: any,
    @Param('id') userId: string,
  ): Promise<{ message: string }> {
    const tenantContext: TenantContext = req.tenantContext;

    if (userId === tenantContext.userId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    await this.usersService.updateUser(tenantContext, userId, {
      status: 'inactive',
    });

    return { message: 'User deleted successfully' };
  }

  @Post('/admin/users/:id/roles')
  @RequirePermissions('user.update')
  async assignRole(
    @Request() req: any,
    @Param('id') userId: string,
    @Body() body: { roleId: string },
  ): Promise<{ message: string; roles: { id: string; name: string }[] }> {
    const tenantContext: TenantContext = req.tenantContext;

    if (!body.roleId) {
      throw new BadRequestException('roleId is required');
    }

    const user = await this.usersService.getUserById(tenantContext, userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersService.assignRoleToUser(tenantContext, userId, body.roleId);

    const roles = await this.permissionsService.getUserRoles(
      tenantContext.organizationId,
      userId,
    );

    return { message: 'Role assigned successfully', roles };
  }

  @Delete('/admin/users/:id/roles/:roleId')
  @RequirePermissions('user.update')
  async removeRole(
    @Request() req: any,
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
  ): Promise<{ message: string; roles: { id: string; name: string }[] }> {
    const tenantContext: TenantContext = req.tenantContext;

    const user = await this.usersService.getUserById(tenantContext, userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersService.removeRoleFromUser(tenantContext, userId, roleId);

    const roles = await this.permissionsService.getUserRoles(
      tenantContext.organizationId,
      userId,
    );

    return { message: 'Role removed successfully', roles };
  }

  @Get('/admin/roles')
  @RequirePermissions('role.read')
  async listRoles(
    @Request() req: any,
  ): Promise<{ roles: { id: string; name: string }[] }> {
    const tenantContext: TenantContext = req.tenantContext;

    const roles = await this.permissionsService.listRoles(
      tenantContext.organizationId,
    );

    return { roles };
  }
}
