import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { LikesRepository, Like, CreateLikeDto } from '../repositories/likes.repository';
import { PostsRepository } from '../repositories/posts.repository';
import { CommentsRepository } from '../repositories/comments.repository';
import { PraiseRepository } from '../repositories/praise.repository';
import { TenantContext } from '../../database/tenant-context';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class LikesService {
  constructor(
    private likesRepository: LikesRepository,
    private postsRepository: PostsRepository,
    private commentsRepository: CommentsRepository,
    private praiseRepository: PraiseRepository,
    private auditService: AuditService,
  ) {}

  async createLike(tenantContext: TenantContext, data: CreateLikeDto): Promise<Like> {
    await this.validateLikeable(tenantContext, data.likeable_type, data.likeable_id);

    const existing = await this.likesRepository.findUserLike(tenantContext, data.likeable_type, data.likeable_id);
    if (existing) {
      throw new ConflictException('User has already liked this item');
    }

    const like = await this.likesRepository.create(tenantContext, data);
    if (!like) {
      throw new ConflictException('User has already liked this item');
    }

    await this.updateLikeableCount(tenantContext, data.likeable_type, data.likeable_id, 1);

    await this.auditService.record(tenantContext, {
      action: 'CREATE',
      entity_type: 'Like',
      entity_id: like.id,
      new_value: like,
    });

    return like;
  }

  async removeLike(tenantContext: TenantContext, likeableType: string, likeableId: string): Promise<void> {
    const like = await this.likesRepository.findUserLike(tenantContext, likeableType, likeableId);
    if (!like) {
      throw new NotFoundException('Like not found');
    }

    await this.likesRepository.deleteByUserAndLikeable(tenantContext, likeableType, likeableId);
    await this.updateLikeableCount(tenantContext, likeableType, likeableId, -1);

    await this.auditService.record(tenantContext, {
      action: 'DELETE',
      entity_type: 'Like',
      entity_id: like.id,
      old_value: like,
    });
  }

  async getLikesByLikeable(likeableType: string, likeableId: string, limit = 100, offset = 0): Promise<Like[]> {
    return this.likesRepository.findByLikeable(likeableType, likeableId, limit, offset);
  }

  async countLikes(likeableType: string, likeableId: string): Promise<number> {
    return this.likesRepository.countByLikeable(likeableType, likeableId);
  }

  private async validateLikeable(tenantContext: TenantContext, likeableType: string, likeableId: string): Promise<void> {
    switch (likeableType) {
      case 'post':
        const post = await this.postsRepository.findById(tenantContext, likeableId);
        if (!post) throw new NotFoundException('Post not found');
        break;
      case 'comment':
        const comment = await this.commentsRepository.findById(tenantContext, likeableId);
        if (!comment) throw new NotFoundException('Comment not found');
        break;
      case 'praise':
        const praise = await this.praiseRepository.findById(tenantContext, likeableId);
        if (!praise) throw new NotFoundException('Praise not found');
        break;
      default:
        throw new NotFoundException('Invalid likeable type');
    }
  }

  private async updateLikeableCount(tenantContext: TenantContext, likeableType: string, likeableId: string, delta: number): Promise<void> {
    switch (likeableType) {
      case 'post':
        if (delta > 0) {
          await this.postsRepository.incrementLikesCount(likeableId);
        } else {
          await this.postsRepository.decrementLikesCount(likeableId);
        }
        break;
      case 'comment':
        if (delta > 0) {
          await this.commentsRepository.incrementLikesCount(likeableId);
        } else {
          await this.commentsRepository.decrementLikesCount(likeableId);
        }
        break;
      case 'praise':
        if (delta > 0) {
          await this.praiseRepository.incrementLikesCount(likeableId);
        } else {
          await this.praiseRepository.decrementLikesCount(likeableId);
        }
        break;
    }
  }
}
