import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CommentsRepository, Comment, CreateCommentDto } from '../repositories/comments.repository';
import { TenantContext } from '../../database/tenant-context';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class CommentsService {
  constructor(private commentsRepository: CommentsRepository, private auditService: AuditService) {}

  async createComment(tenantContext: TenantContext, data: CreateCommentDto): Promise<Comment> {
    if (!data.content || data.content.trim().length === 0) {
      throw new BadRequestException('Comment content cannot be empty');
    }

    const comment = await this.commentsRepository.create(tenantContext, data);

    await this.auditService.record(tenantContext, {
      action: 'CREATE',
      entity_type: 'Comment',
      entity_id: comment.id,
      new_value: comment,
    });

    return comment;
  }

  async getComment(tenantContext: TenantContext, commentId: string): Promise<Comment> {
    const comment = await this.commentsRepository.findById(tenantContext, commentId);
    if (!comment) {
      throw new NotFoundException(`Comment ${commentId} not found`);
    }
    return comment;
  }

  async listCommentsByCommentable(
    tenantContext: TenantContext,
    commentableType: string,
    commentableId: string,
    limit = 20,
    offset = 0,
  ): Promise<Comment[]> {
    return this.commentsRepository.findByCommentable(tenantContext, commentableType, commentableId, limit, offset);
  }

  async listCommentsByUser(tenantContext: TenantContext, userId: string, limit = 20, offset = 0): Promise<Comment[]> {
    return this.commentsRepository.findByUser(tenantContext, userId, limit, offset);
  }

  async updateComment(tenantContext: TenantContext, commentId: string, data: Partial<CreateCommentDto>): Promise<Comment> {
    const comment = await this.getComment(tenantContext, commentId);

    if (data.content && data.content.trim().length === 0) {
      throw new BadRequestException('Comment content cannot be empty');
    }

    const updated = await this.commentsRepository.update(tenantContext, commentId, data);
    if (!updated) {
      throw new BadRequestException('Failed to update comment');
    }

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'Comment',
      entity_id: commentId,
      old_value: comment,
      new_value: updated,
    });

    return updated;
  }

  async deleteComment(tenantContext: TenantContext, commentId: string): Promise<void> {
    const comment = await this.getComment(tenantContext, commentId);

    await this.commentsRepository.delete(tenantContext, commentId);

    await this.auditService.record(tenantContext, {
      action: 'DELETE',
      entity_type: 'Comment',
      entity_id: commentId,
      old_value: comment,
    });
  }

  async addLike(tenantContext: TenantContext, commentId: string): Promise<number> {
    await this.getComment(tenantContext, commentId);
    return this.commentsRepository.incrementLikesCount(commentId);
  }

  async removeLike(tenantContext: TenantContext, commentId: string): Promise<number> {
    await this.getComment(tenantContext, commentId);
    return this.commentsRepository.decrementLikesCount(commentId);
  }
}
