import { ForbiddenException, NotFoundException } from '@nestjs/common';
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

describe('PostsService.updatePost — ownership check (P1-18)', () => {
  let postsRepository: any;
  let auditService: any;
  let service: PostsService;

  const post = { id: 'post-1', user_id: 'author-1', content: 'original' };

  beforeEach(() => {
    postsRepository = {
      findById: jest.fn().mockResolvedValue(post),
      update: jest.fn().mockResolvedValue({ ...post, content: 'edited' }),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    service = new PostsService(postsRepository, auditService);
  });

  it('throws NotFoundException before any ownership check for a nonexistent post', async () => {
    postsRepository.findById.mockResolvedValueOnce(undefined);
    const ctx = makeContext({ userId: 'author-1' });
    await expect(service.updatePost(ctx, 'missing', { content: 'x' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('the author can edit their own post', async () => {
    const ctx = makeContext({ userId: 'author-1' });
    await expect(service.updatePost(ctx, 'post-1', { content: 'edited' })).resolves.toBeDefined();
  });

  it('any other user, regardless of role or scope, gets 403', async () => {
    const ctx = makeContext({ userId: 'someone-else' });
    await expect(service.updatePost(ctx, 'post-1', { content: 'edited' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(postsRepository.update).not.toHaveBeenCalled();
  });

  it('does not call assertActingOnEmployee or consult scope at all - pure ownership, not management scope', async () => {
    // Org-wide scope should NOT override authorship for this check.
    const ctx = makeContext({ userId: 'someone-else', scope: ORG_SCOPE });
    await expect(service.updatePost(ctx, 'post-1', { content: 'edited' })).rejects.toThrow(
      ForbiddenException,
    );
  });
});

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
