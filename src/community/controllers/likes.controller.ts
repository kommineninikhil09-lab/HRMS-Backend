import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { LikesService } from '../services/likes.service';
import { CreateLikeRequestDto, LikeResponseDto, LikeListResponseDto } from '../dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantContextDecorator, type TenantContext } from '../../database/tenant-context';

@Controller('community/likes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LikesController {
  constructor(private likesService: LikesService) {}

  @Post()
  @RequirePermissions('like.create')
  async createLike(@TenantContextDecorator() tenantContext: TenantContext, @Body() dto: CreateLikeRequestDto): Promise<LikeResponseDto> {
    const like = await this.likesService.createLike(tenantContext, dto);
    return this.mapToResponse(like);
  }

  @Get()
  @RequirePermissions('like.create')
  async listLikes(
    @Query('likeable_type') likeableType: string,
    @Query('likeable_id') likeableId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<LikeListResponseDto[]> {
    const likes = await this.likesService.getLikesByLikeable(likeableType, likeableId, parseInt(limit || '100'), parseInt(offset || '0'));
    return likes.map((l) => this.mapToListResponse(l));
  }

  @Get('count')
  @RequirePermissions('like.create')
  async countLikes(@Query('likeable_type') likeableType: string, @Query('likeable_id') likeableId: string): Promise<{ count: number }> {
    const count = await this.likesService.countLikes(likeableType, likeableId);
    return { count };
  }

  @Delete(':likeable_type/:likeable_id')
  @RequirePermissions('like.create')
  async removeLike(@TenantContextDecorator() tenantContext: TenantContext, @Param('likeable_type') likeableType: string, @Param('likeable_id') likeableId: string): Promise<{ success: boolean }> {
    await this.likesService.removeLike(tenantContext, likeableType, likeableId);
    return { success: true };
  }

  private mapToResponse(like: any): LikeResponseDto {
    return {
      id: like.id,
      user_id: like.user_id,
      likeable_type: like.likeable_type,
      likeable_id: like.likeable_id,
      created_at: like.created_at,
    };
  }

  private mapToListResponse(like: any): LikeListResponseDto {
    return {
      id: like.id,
      user_id: like.user_id,
      likeable_type: like.likeable_type,
      likeable_id: like.likeable_id,
      created_at: like.created_at,
    };
  }
}
