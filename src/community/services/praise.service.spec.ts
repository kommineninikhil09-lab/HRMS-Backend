import { PraiseService } from './praise.service';
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

describe('PraiseService.addLike/removeLike — audit coverage (P3-03)', () => {
  let praiseRepository: any;
  let auditService: any;
  let service: PraiseService;

  const praise = { id: 'praise-1', from_user_id: 'user-1', to_employee_id: 'employee-2' };

  beforeEach(() => {
    praiseRepository = {
      findById: jest.fn().mockResolvedValue(praise),
      incrementLikesCount: jest.fn().mockResolvedValue(3),
      decrementLikesCount: jest.fn().mockResolvedValue(2),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    service = new PraiseService(praiseRepository, auditService);
  });

  it('addLike records an UPDATE audit entry with the new count', async () => {
    const ctx = makeContext();
    await service.addLike(ctx, 'praise-1');
    expect(auditService.record).toHaveBeenCalledWith(ctx, {
      action: 'UPDATE',
      entity_type: 'Praise',
      entity_id: 'praise-1',
      new_value: { likes_count: 3 },
    });
  });

  it('removeLike records an UPDATE audit entry with the new count', async () => {
    const ctx = makeContext();
    await service.removeLike(ctx, 'praise-1');
    expect(auditService.record).toHaveBeenCalledWith(ctx, {
      action: 'UPDATE',
      entity_type: 'Praise',
      entity_id: 'praise-1',
      new_value: { likes_count: 2 },
    });
  });
});
