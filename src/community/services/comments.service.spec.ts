import { CommentsService } from './comments.service';
import { TenantContext } from '../../database/tenant-context';

function makeContext(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    organizationId: 'org-1',
    userId: 'user-1',
    employeeId: 'self-employee-1',
    requestId: 'req-1',
    permissions: [],
    ...overrides,
  };
}

describe('CommentsService.addLike/removeLike — audit coverage (P3-03)', () => {
  let commentsRepository: any;
  let auditService: any;
  let service: CommentsService;

  const comment = { id: 'comment-1', user_id: 'author-1', content: 'nice work' };

  beforeEach(() => {
    commentsRepository = {
      findById: jest.fn().mockResolvedValue(comment),
      incrementLikesCount: jest.fn().mockResolvedValue(2),
      decrementLikesCount: jest.fn().mockResolvedValue(1),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    service = new CommentsService(commentsRepository, auditService);
  });

  it('addLike records an UPDATE audit entry with the new count', async () => {
    const ctx = makeContext();
    await service.addLike(ctx, 'comment-1');
    expect(auditService.record).toHaveBeenCalledWith(ctx, {
      action: 'UPDATE',
      entity_type: 'Comment',
      entity_id: 'comment-1',
      new_value: { likes_count: 2 },
    });
  });

  it('removeLike records an UPDATE audit entry with the new count', async () => {
    const ctx = makeContext();
    await service.removeLike(ctx, 'comment-1');
    expect(auditService.record).toHaveBeenCalledWith(ctx, {
      action: 'UPDATE',
      entity_type: 'Comment',
      entity_id: 'comment-1',
      new_value: { likes_count: 1 },
    });
  });
});
