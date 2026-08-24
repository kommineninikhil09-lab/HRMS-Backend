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
  roleIds?: string[];
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

  /**
   * GET /users/me - Get current user details
   */
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

  /**
   * GET /admin/users - List all users (paginated, filterable)
   * Requires: users.list permission
   */
  @Get('/admin/users')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('users.list')
  async listUsers(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ): Promise<UserListResponse> {
    const tenantContext: TenantContext = req.tenantContext;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    const result = await this.usersService.listUsersByOrganization(
      tenantContext,
      {
        page: pageNum,
        limit: limitNum,
        search,
        role,
        status,
      },
    );

    const users = await Promise.all(
      result.users.map(async (user) => {
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
      success: true,
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: result.total,
          totalPages: Math.ceil(result.total / limitNum),
        },
      },
    };
  }

  /**
   * GET /admin/users/:id - Get user details with roles and permissions
   * Requires: users.list permission
   */
  @Get('/admin/users/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('users.list')
  async getUserDetail(
    @Request() req: any,
    @Param('id') userId: string,
  ): Promise<{ success: boolean; data: UserWithPermissions }> {
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

  /**
   * POST /admin/users - Create new user
   * Requires: users.create permission
   */
  @Post('/admin/users')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('users.create')
  async createUser(
    @Request() req: any,
    @Body() createUserDto: CreateUserDto,
  ): Promise<{ success: boolean; data: UserWithPermissions }> {
    const tenantContext: TenantContext = req.tenantContext;

    // Validate required fields
    if (!createUserDto.email || !createUserDto.password || !createUserDto.firstName || !createUserDto.lastName) {
      throw new BadRequestException('Missing required fields: email, password, firstName, lastName');
    }

    // Create user
    const user = await this.usersService.createUser(
      tenantContext,
      {
        email: createUserDto.email,
        password: createUserDto.password,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
      },
      tenantContext.userId, // created_by
    );

    // Assign roles if provided
    if (createUserDto.roleIds && createUserDto.roleIds.length > 0) {
      // TODO: Implement role assignment
    }

    const roles = await this.permissionsService.getUserRoles(
      tenantContext.organizationId,
      user.id,
    );

    const permissions = await this.permissionsService.getEffectivePermissions(
      tenantContext.organizationId,
      user.id,
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

  /**
   * PUT /admin/users/:id - Update user
   * Requires: users.edit permission
   */
  @Put('/admin/users/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('users.edit')
  async updateUser(
    @Request() req: any,
    @Param('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<{ success: boolean; data: UserWithPermissions }> {
    const tenantContext: TenantContext = req.tenantContext;

    const user = await this.usersService.getUserById(tenantContext, userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update user
    const updatedUser = await this.usersService.updateUser(
      tenantContext,
      userId,
      updateUserDto,
    );

    const roles = await this.permissionsService.getUserRoles(
      tenantContext.organizationId,
      updatedUser.id,
    );

    const permissions = await this.permissionsService.getEffectivePermissions(
      tenantContext.organizationId,
      updatedUser.id,
    );

    return {
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        roles,
        permissions,
      },
    };
  }

  /**
   * DELETE /admin/users/:id - Soft delete user (set status to inactive)
   * Requires: users.delete permission
   */
  @Delete('/admin/users/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('users.delete')
  async deleteUser(
    @Request() req: any,
    @Param('id') userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const tenantContext: TenantContext = req.tenantContext;

    // Prevent deleting oneself
    if (userId === tenantContext.userId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    const user = await this.usersService.getUserById(tenantContext, userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete
    await this.usersService.updateUser(
      tenantContext,
      userId,
      { status: 'inactive' },
    );

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }

  /**
   * POST /admin/users/:id/roles - Assign role to user
   * Requires: users.manage permission
   */
  @Post('/admin/users/:id/roles')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('users.manage')
  async assignRoleToUser(
    @Request() req: any,
    @Param('id') userId: string,
    @Body() body: { roleId: string },
  ): Promise<{ success: boolean; data: UserWithPermissions }> {
    const tenantContext: TenantContext = req.tenantContext;

    if (!body.roleId) {
      throw new BadRequestException('roleId is required');
    }

    const user = await this.usersService.getUserById(tenantContext, userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // TODO: Implement assignRoleToUser in UsersService
    console.log(`Assigning role ${body.roleId} to user ${userId}`);

    const roles = await this.permissionsService.getUserRoles(
      tenantContext.organizationId,
      userId,
    );

    const permissions = await this.permissionsService.getEffectivePermissions(
      tenantContext.organizationId,
      userId,
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

  /**
   * DELETE /admin/users/:id/roles/:roleId - Remove role from user
   * Requires: users.manage permission
   */
  @Delete('/admin/users/:id/roles/:roleId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('users.manage')
  async removeRoleFromUser(
    @Request() req: any,
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
  ): Promise<{ success: boolean; message: string }> {
    const tenantContext: TenantContext = req.tenantContext;

    const user = await this.usersService.getUserById(tenantContext, userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // TODO: Implement removeRoleFromUser in UsersService
    console.log(`Removing role ${roleId} from user ${userId}`);

    return {
      success: true,
      message: 'Role removed successfully',
    };
  }
}
