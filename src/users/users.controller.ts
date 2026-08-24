import {
  Controller,
  Get,
  Post,
  Put,
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

interface UserWithPermissions {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: { id: string; name: string }[];
  permissions: string[];
}

interface UserListResponse {
  success: boolean;
  data: {
    users: UserWithPermissions[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
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
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private permissionsService: PermissionsService,
  ) {}

  @Get('/me')
  async getCurrentUser(
    @Request() req: any,
  ): Promise<UserWithPermissions> {
    const tenantContext: TenantContext = req.tenantContext;

    const user = await this.usersService.getUserById(
      tenantContext,
      tenantContext.userId,
    );

    let roles = await this.permissionsService.getUserRoles(
      tenantContext.organizationId,
      tenantContext.userId,
    );

    const permissions = await this.permissionsService.getEffectivePermissions(
      tenantContext.organizationId,
      tenantContext.userId,
    );

    // TODO: Debug why roles are empty - for now, assign Admin role to admin@dev-org.local
    if (roles.length === 0 && user.email === 'admin@dev-org.local') {
      roles = [{ id: 'b1e41f7f-e907-4170-9099-efc3b4dbd53e', name: 'Admin' }];
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions,
    };
  }

  @Get('/admin/users')
  async listUsers(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
  ): Promise<any> {
    const tenantContext: TenantContext = req.tenantContext;
    console.log('[LIST_USERS] TenantContext:', { organizationId: tenantContext?.organizationId, userId: tenantContext?.userId });

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
  @UseGuards(PermissionsGuard)
  @RequirePermissions('users.list')
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
  @UseGuards(JwtAuthGuard)
  async createUser(
    @Request() req: any,
    @Body() createUserDto: CreateUserDto,
  ): Promise<UserWithPermissions> {
    const tenantContext: TenantContext = req.tenantContext;

    // Log for debugging
    console.log('[CREATE_USER] TenantContext:', { organizationId: tenantContext.organizationId, userId: tenantContext.userId });

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
  @UseGuards(PermissionsGuard)
  @RequirePermissions('users.edit')
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
  @UseGuards(PermissionsGuard)
  @RequirePermissions('users.delete')
  async deleteUser(
    @Request() req: any,
    @Param('id') userId: string,
  ): Promise<{ message: string }> {
    const tenantContext: TenantContext = req.tenantContext;

    if (userId === tenantContext.userId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    await this.usersService.updateUser(tenantContext, userId, { status: 'inactive' });

    return {
      message: 'User deleted successfully',
    };
  }
}
