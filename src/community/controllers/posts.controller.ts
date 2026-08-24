import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PostsService } from '../services/posts.service';
import { CreatePostRequestDto, UpdatePostRequestDto, PostResponseDto, PostListResponseDto } from '../dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { TenantContext } from '../../database/tenant-context';

@Controller('community/posts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Post()
  @RequirePermissions('post.create')
  async createPost(@CurrentUser() tenantContext: TenantContext, @Body() dto: CreatePostRequestDto): Promise<PostResponseDto> {
    const post = await this.postsService.createPost(tenantContext, dto);
    return this.mapToResponse(post);
  }

  @Get()
  @RequirePermissions('post.read')
  async listPosts(
    @CurrentUser() tenantContext: TenantContext,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PostListResponseDto[]> {
    const { posts } = await this.postsService.listPostsByOrganization(tenantContext, parseInt(limit || '20'), parseInt(offset || '0'));
    return posts.map((p) => this.mapToListResponse(p));
  }

  @Get(':id')
  @RequirePermissions('post.read')
  async getPost(@CurrentUser() tenantContext: TenantContext, @Param('id') id: string): Promise<PostResponseDto> {
    const post = await this.postsService.getPost(tenantContext, id);
    return this.mapToResponse(post);
  }

  @Put(':id')
  @RequirePermissions('post.update')
  async updatePost(
    @CurrentUser() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdatePostRequestDto,
  ): Promise<PostResponseDto> {
    const post = await this.postsService.updatePost(tenantContext, id, dto);
    return this.mapToResponse(post);
  }

  @Delete(':id')
  @RequirePermissions('post.delete')
  async deletePost(@CurrentUser() tenantContext: TenantContext, @Param('id') id: string): Promise<{ success: boolean }> {
    await this.postsService.deletePost(tenantContext, id);
    return { success: true };
  }

  @Post(':id/like')
  @RequirePermissions('like.create')
  async addLike(@CurrentUser() tenantContext: TenantContext, @Param('id') id: string): Promise<{ likes_count: number }> {
    const count = await this.postsService.addLike(tenantContext, id);
    return { likes_count: count };
  }

  @Delete(':id/like')
  @RequirePermissions('like.create')
  async removeLike(@CurrentUser() tenantContext: TenantContext, @Param('id') id: string): Promise<{ likes_count: number }> {
    const count = await this.postsService.removeLike(tenantContext, id);
    return { likes_count: count };
  }

  private mapToResponse(post: any): PostResponseDto {
    return {
      id: post.id,
      organization_id: post.organization_id,
      user_id: post.user_id,
      content: post.content,
      category: post.category,
      status: post.status,
      likes_count: post.likes_count,
      comments_count: post.comments_count,
      created_at: post.created_at,
      updated_at: post.updated_at,
      created_by: post.created_by,
      updated_by: post.updated_by,
    };
  }

  private mapToListResponse(post: any): PostListResponseDto {
    return {
      id: post.id,
      organization_id: post.organization_id,
      user_id: post.user_id,
      content: post.content,
      category: post.category,
      status: post.status,
      likes_count: post.likes_count,
      comments_count: post.comments_count,
      created_at: post.created_at,
    };
  }
}
