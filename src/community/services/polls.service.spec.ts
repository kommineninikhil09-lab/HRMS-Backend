import { PollsService } from './polls.service';
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

describe('PollsService.recordVote — audit coverage (P3-03)', () => {
  let pollsRepository: any;
  let auditService: any;
  let service: PollsService;

  beforeEach(() => {
    pollsRepository = {
      incrementVoteCount: jest.fn().mockResolvedValue(undefined),
      incrementTotalVotes: jest.fn().mockResolvedValue(undefined),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    service = new PollsService(pollsRepository, auditService);
  });

  it('bumps both counters and records an UPDATE audit entry naming the chosen option', async () => {
    const ctx = makeContext();
    await service.recordVote(ctx, 'option-1', 'poll-1');

    expect(pollsRepository.incrementVoteCount).toHaveBeenCalledWith('option-1');
    expect(pollsRepository.incrementTotalVotes).toHaveBeenCalledWith('poll-1');
    expect(auditService.record).toHaveBeenCalledWith(ctx, {
      action: 'UPDATE',
      entity_type: 'Poll',
      entity_id: 'poll-1',
      new_value: { poll_option_id: 'option-1' },
    });
  });
});
