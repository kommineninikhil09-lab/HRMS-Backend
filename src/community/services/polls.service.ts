import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PollsRepository, Poll, PollOption, CreatePollDto } from '../repositories/polls.repository';
import { TenantContext } from '../../database/tenant-context';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class PollsService {
  constructor(private pollsRepository: PollsRepository, private auditService: AuditService) {}

  async createPoll(tenantContext: TenantContext, data: CreatePollDto): Promise<{ poll: Poll; options: PollOption[] }> {
    if (!data.options || data.options.length < 2) {
      throw new BadRequestException('Poll must have at least 2 options');
    }

    const { poll, options } = await this.pollsRepository.createWithOptions(tenantContext, data);

    await this.auditService.record(tenantContext, {
      action: 'CREATE',
      entity_type: 'Poll',
      entity_id: poll.id,
      new_value: { poll, options },
    });

    return { poll, options };
  }

  async getPoll(tenantContext: TenantContext, pollId: string): Promise<{ poll: Poll; options: PollOption[] }> {
    const result = await this.pollsRepository.findByIdWithOptions(tenantContext, pollId);
    if (!result) {
      throw new NotFoundException(`Poll ${pollId} not found`);
    }
    return result;
  }

  async listPollsByOrganization(tenantContext: TenantContext, status?: string, limit = 20, offset = 0): Promise<Poll[]> {
    return this.pollsRepository.findByOrganization(tenantContext, status, limit, offset);
  }

  async updatePoll(tenantContext: TenantContext, pollId: string, data: Partial<CreatePollDto>): Promise<Poll> {
    const { poll } = await this.getPoll(tenantContext, pollId);

    const updated = await this.pollsRepository.update(tenantContext, pollId, data);
    if (!updated) {
      throw new BadRequestException('Failed to update poll');
    }

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'Poll',
      entity_id: pollId,
      old_value: poll,
      new_value: updated,
    });

    return updated;
  }

  async closePoll(tenantContext: TenantContext, pollId: string): Promise<Poll> {
    const { poll } = await this.getPoll(tenantContext, pollId);

    const closed = await this.pollsRepository.closePoll(tenantContext, pollId);
    if (!closed) {
      throw new BadRequestException('Failed to close poll');
    }

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'Poll',
      entity_id: pollId,
      old_value: poll,
      new_value: closed,
    });

    return closed;
  }

  async recordVote(pollOptionId: string, pollId: string): Promise<void> {
    await this.pollsRepository.incrementVoteCount(pollOptionId);
    await this.pollsRepository.incrementTotalVotes(pollId);
  }
}
