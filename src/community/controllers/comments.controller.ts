import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CommentsService } from '../services/comments.service';
import { CreateCommentRequestDto, UpdateCommentRequestDto, CommentResponseDto, CommentListResponseDto } from '../dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { TenantContext } from '../../database/tenant-context';

@Controller('community/comments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Post()
  @RequirePermissions('comment.create')
  async createComment(@CurrentUser() tenantContext: TenantContext, @Body() dto: CreateCommentRequestDto): Promise<CommentResponseDto> {
    const comment = await this.commentsService.createComment(tenantContext, dto);
    return this.mapToResponse(comment);
  }

  @Get()
  @RequirePermissions('comment.read')
  async listComments(
    @CurrentUser() tenantContext: TenantContext,
    @Query('commentable_type') commentableType: string,
    @Query('commentable_id') commentableId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<CommentListResponseDto[]> {
    const comments = await this.commentsService.listCommentsByCommentable(
      tenantContext,
      commentableType,
      commentableId,
      parseInt(limit || '20'),
      parseInt(offset || '0'),
    );
    return comments.map((c) => this.mapToListResponse(c));
  }

  @Get(':id')
  @RequirePermissions('comment.read')
  async getComment(@CurrentUser() tenantContext: TenantContext, @Param('id') id: string): Promise<CommentResponseDto> {
    const comment = await this.commentsService.getComment(tenantContext, id);
    return this.mapToResponse(comment);
  }

  @Put(':id')
  @RequirePermissions('comment.update')
  async updateComment(
    @CurrentUser() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCommentRequestDto,
  ): Promise<CommentResponseDto> {
    const comment = await this.commentsService.updateComment(tenantContext, id, dto);
    return this.mapToResponse(comment);
  }

  @Delete(':id')
  @RequirePermissions('comment.delete')
  async deleteComment(@CurrentUser() tenantContext: TenantContext, @Param('id') id: string): Promise<{ success: boolean }> {
    await this.commentsService.deleteComment(tenantContext, id);
    return { success: true };
  }

  @Post(':id/like')
  @RequirePermissions('like.create')
  async addLike(@CurrentUser() tenantContext: TenantContext, @Param('id') id: string): Promise<{ likes_count: number }> {
    const count = await this.commentsService.addLike(tenantContext, id);
    return { likes_count: count };
  }

  @Delete(':id/like')
  @RequirePermissions('like.create')
  async removeLike(@CurrentUser() tenantContext: TenantContext, @Param('id') id: string): Promise<{ likes_count: number }> {
    const count = await this.commentsService.removeLike(tenantContext, id);
    return { likes_count: count };
  }

  private mapToResponse(comment: any): CommentResponseDto {
    return {
      id: comment.id,
      organization_id: comment.organization_id,
      user_id: comment.user_id,
      content: comment.content,
      commentable_type: comment.commentable_type,
      commentable_id: comment.commentable_id,
      status: comment.status,
      likes_count: comment.likes_count,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      created_by: comment.created_by,
    };
  }

  private mapToListResponse(comment: any): CommentListResponseDto {
    return {
      id: comment.id,
      user_id: comment.user_id,
      content: comment.content,
      commentable_type: comment.commentable_type,
      commentable_id: comment.commentable_id,
      likes_count: comment.likes_count,
      created_at: comment.created_at,
    };
  }
}
