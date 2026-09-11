import { ForbiddenException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { TenantContext, ORG_SCOPE, SELF_SCOPE } from '../../database/tenant-context';

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

describe('PostsService.deletePost — author or moderator (P1-19)', () => {
  let postsRepository: any;
  let auditService: any;
  let service: PostsService;

  const post = { id: 'post-1', user_id: 'author-1', content: 'original' };

  beforeEach(() => {
    postsRepository = {
      findById: jest.fn().mockResolvedValue(post),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    service = new PostsService(postsRepository, auditService);
  });

  it('the author can delete their own post without org-wide scope', async () => {
    const ctx = makeContext({ userId: 'author-1', scope: SELF_SCOPE });
    await service.deletePost(ctx, 'post-1');
    expect(postsRepository.delete).toHaveBeenCalledWith(ctx, 'post-1');
  });

  it('a moderator (org-wide scope) can delete anyone\'s post', async () => {
    const ctx = makeContext({ userId: 'someone-else', scope: ORG_SCOPE });
    await service.deletePost(ctx, 'post-1');
    expect(postsRepository.delete).toHaveBeenCalledWith(ctx, 'post-1');
  });

  it('a non-author without org-wide scope gets 403', async () => {
    const ctx = makeContext({
      userId: 'someone-else',
      scope: { kind: 'team', employeeIds: new Set() },
    });
    await expect(service.deletePost(ctx, 'post-1')).rejects.toThrow(ForbiddenException);
    expect(postsRepository.delete).not.toHaveBeenCalled();
  });
});
