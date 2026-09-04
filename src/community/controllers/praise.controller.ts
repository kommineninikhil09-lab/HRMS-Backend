import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PraiseService } from '../services/praise.service';
import { CreatePraiseRequestDto, UpdatePraiseRequestDto, PraiseResponseDto, PraiseListResponseDto } from '../dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantContextDecorator, type TenantContext } from '../../database/tenant-context';

@Controller('community/praise')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PraiseController {
  constructor(private praiseService: PraiseService) {}

  @Post()
  @RequirePermissions('praise.create')
  async createPraise(@TenantContextDecorator() tenantContext: TenantContext, @Body() dto: CreatePraiseRequestDto): Promise<PraiseResponseDto> {
    const praise = await this.praiseService.createPraise(tenantContext, dto);
    return this.mapToResponse(praise);
  }

  @Get()
  @RequirePermissions('praise.read')
  async listPraise(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PraiseListResponseDto[]> {
    const praise = await this.praiseService.listPraiseByOrganization(tenantContext, parseInt(limit || '20'), parseInt(offset || '0'));
    return praise.map((p) => this.mapToListResponse(p));
  }

  @Get('employee/:employeeId')
  @RequirePermissions('praise.read')
  async listPraiseForEmployee(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('employeeId') employeeId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PraiseListResponseDto[]> {
    const praise = await this.praiseService.listPraiseForEmployee(tenantContext, employeeId, parseInt(limit || '20'), parseInt(offset || '0'));
    return praise.map((p) => this.mapToListResponse(p));
  }

  @Get('badge/:badgeType')
  @RequirePermissions('praise.read')
  async listPraiseByBadge(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('badgeType') badgeType: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PraiseListResponseDto[]> {
    const praise = await this.praiseService.listPraiseByBadgeType(tenantContext, badgeType, parseInt(limit || '20'), parseInt(offset || '0'));
    return praise.map((p) => this.mapToListResponse(p));
  }

  @Get(':id')
  @RequirePermissions('praise.read')
  async getPraise(@TenantContextDecorator() tenantContext: TenantContext, @Param('id') id: string): Promise<PraiseResponseDto> {
    const praise = await this.praiseService.getPraise(tenantContext, id);
    return this.mapToResponse(praise);
  }

  @Put(':id')
  @RequirePermissions('praise.update')
  async updatePraise(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdatePraiseRequestDto,
  ): Promise<PraiseResponseDto> {
    const praise = await this.praiseService.updatePraise(tenantContext, id, dto);
    return this.mapToResponse(praise);
  }

  @Delete(':id')
  @RequirePermissions('praise.delete')
  async deletePraise(@TenantContextDecorator() tenantContext: TenantContext, @Param('id') id: string): Promise<{ success: boolean }> {
    await this.praiseService.deletePraise(tenantContext, id);
    return { success: true };
  }

  @Post(':id/like')
  @RequirePermissions('like.create')
  async addLike(@TenantContextDecorator() tenantContext: TenantContext, @Param('id') id: string): Promise<{ likes_count: number }> {
    const count = await this.praiseService.addLike(tenantContext, id);
    return { likes_count: count };
  }

  @Delete(':id/like')
  @RequirePermissions('like.create')
  async removeLike(@TenantContextDecorator() tenantContext: TenantContext, @Param('id') id: string): Promise<{ likes_count: number }> {
    const count = await this.praiseService.removeLike(tenantContext, id);
    return { likes_count: count };
  }

  @Get('badge-types')
  @RequirePermissions('praise.read')
  async getBadgeTypes(): Promise<{ badge_types: string[] }> {
    return { badge_types: this.praiseService.getValidBadgeTypes() };
  }

  private mapToResponse(praise: any): PraiseResponseDto {
    return {
      id: praise.id,
      organization_id: praise.organization_id,
      from_user_id: praise.from_user_id,
      to_employee_id: praise.to_employee_id,
      badge_type: praise.badge_type,
      description: praise.description,
      project_id: praise.project_id,
      visibility: praise.visibility,
      likes_count: praise.likes_count,
      comments_count: praise.comments_count,
      created_at: praise.created_at,
      updated_at: praise.updated_at,
    };
  }

  private mapToListResponse(praise: any): PraiseListResponseDto {
    return {
      id: praise.id,
      from_user_id: praise.from_user_id,
      to_employee_id: praise.to_employee_id,
      badge_type: praise.badge_type,
      description: praise.description,
      visibility: praise.visibility,
      likes_count: praise.likes_count,
      comments_count: praise.comments_count,
      created_at: praise.created_at,
    };
  }
}
