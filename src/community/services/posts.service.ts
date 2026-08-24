import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PostsRepository, Post, CreatePostDto } from '../repositories/posts.repository';
import { TenantContext } from '../../database/tenant-context';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class PostsService {
  constructor(private postsRepository: PostsRepository, private auditService: AuditService) {}

  async createPost(tenantContext: TenantContext, data: CreatePostDto): Promise<Post> {
    const post = await this.postsRepository.create(tenantContext, data);

    await this.auditService.record(tenantContext, {
      action: 'CREATE',
      entity_type: 'Post',
      entity_id: post.id,
      new_value: post,
    });

    return post;
  }

  async getPost(tenantContext: TenantContext, postId: string): Promise<Post> {
    const post = await this.postsRepository.findById(tenantContext, postId);
    if (!post) {
      throw new NotFoundException(`Post ${postId} not found`);
    }
    return post;
  }

  async listPostsByOrganization(tenantContext: TenantContext, limit = 20, offset = 0): Promise<{ posts: Post[]; total: number }> {
    const posts = await this.postsRepository.findByOrganization(tenantContext, limit, offset);
    return { posts, total: posts.length };
  }

  async listPostsByUser(tenantContext: TenantContext, userId: string, limit = 20, offset = 0): Promise<Post[]> {
    return this.postsRepository.findByUser(tenantContext, userId, limit, offset);
  }

  async updatePost(tenantContext: TenantContext, postId: string, data: Partial<CreatePostDto>): Promise<Post> {
    const post = await this.getPost(tenantContext, postId);

    const updated = await this.postsRepository.update(tenantContext, postId, data);
    if (!updated) {
      throw new BadRequestException('Failed to update post');
    }

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'Post',
      entity_id: postId,
      old_value: post,
      new_value: updated,
    });

    return updated;
  }

  async deletePost(tenantContext: TenantContext, postId: string): Promise<void> {
    const post = await this.getPost(tenantContext, postId);

    await this.postsRepository.delete(tenantContext, postId);

    await this.auditService.record(tenantContext, {
      action: 'DELETE',
      entity_type: 'Post',
      entity_id: postId,
      old_value: post,
    });
  }

  async addLike(tenantContext: TenantContext, postId: string): Promise<number> {
    await this.getPost(tenantContext, postId);
    const count = await this.postsRepository.incrementLikesCount(postId);
    return count;
  }

  async removeLike(tenantContext: TenantContext, postId: string): Promise<number> {
    await this.getPost(tenantContext, postId);
    const count = await this.postsRepository.decrementLikesCount(postId);
    return count;
  }

  async addComment(tenantContext: TenantContext, postId: string): Promise<number> {
    await this.getPost(tenantContext, postId);
    const count = await this.postsRepository.incrementCommentsCount(postId);
    return count;
  }

  async removeComment(tenantContext: TenantContext, postId: string): Promise<number> {
    await this.getPost(tenantContext, postId);
    const count = await this.postsRepository.decrementCommentsCount(postId);
    return count;
  }
}
