import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PollsService } from '../services/polls.service';
import { CreatePollRequestDto, UpdatePollRequestDto, VotePollRequestDto, PollResponseDto, PollListResponseDto } from '../dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantContextDecorator, type TenantContext } from '../../database/tenant-context';

@Controller('community/polls')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PollsController {
  constructor(private pollsService: PollsService) {}

  @Post()
  @RequirePermissions('poll.create')
  async createPoll(@TenantContextDecorator() tenantContext: TenantContext, @Body() dto: CreatePollRequestDto): Promise<PollResponseDto> {
    const { poll, options } = await this.pollsService.createPoll(tenantContext, dto);
    return this.mapToResponse(poll, options);
  }

  @Get()
  @RequirePermissions('poll.read')
  async listPolls(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PollListResponseDto[]> {
    const polls = await this.pollsService.listPollsByOrganization(tenantContext, status, parseInt(limit || '20'), parseInt(offset || '0'));
    return polls.map((p) => this.mapToListResponse(p));
  }

  @Get(':id')
  @RequirePermissions('poll.read')
  async getPoll(@TenantContextDecorator() tenantContext: TenantContext, @Param('id') id: string): Promise<PollResponseDto> {
    const { poll, options } = await this.pollsService.getPoll(tenantContext, id);
    return this.mapToResponse(poll, options);
  }

  @Put(':id')
  @RequirePermissions('poll.update')
  async updatePoll(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdatePollRequestDto,
  ): Promise<PollResponseDto> {
    const poll = await this.pollsService.updatePoll(tenantContext, id, dto);
    return this.mapToResponse(poll);
  }

  @Delete(':id')
  @RequirePermissions('poll.delete')
  async deletePoll(@TenantContextDecorator() tenantContext: TenantContext, @Param('id') id: string): Promise<{ success: boolean }> {
    await this.pollsService.closePoll(tenantContext, id);
    return { success: true };
  }

  @Post(':id/vote')
  @RequirePermissions('poll.vote')
  async votePoll(
    @TenantContextDecorator() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: VotePollRequestDto,
  ): Promise<{ success: boolean }> {
    await this.pollsService.recordVote(dto.poll_option_id, id);
    return { success: true };
  }

  @Post(':id/close')
  @RequirePermissions('poll.moderate')
  async closePoll(@TenantContextDecorator() tenantContext: TenantContext, @Param('id') id: string): Promise<PollResponseDto> {
    const poll = await this.pollsService.closePoll(tenantContext, id);
    return this.mapToResponse(poll);
  }

  private mapToResponse(poll: any, options?: any): PollResponseDto {
    return {
      id: poll.id,
      organization_id: poll.organization_id,
      user_id: poll.user_id,
      question: poll.question,
      description: poll.description,
      notify_employees: poll.notify_employees,
      is_anonymous: poll.is_anonymous,
      total_votes: poll.total_votes,
      status: poll.status,
      expires_at: poll.expires_at,
      created_at: poll.created_at,
      updated_at: poll.updated_at,
      options: options,
    };
  }

  private mapToListResponse(poll: any): PollListResponseDto {
    return {
      id: poll.id,
      organization_id: poll.organization_id,
      user_id: poll.user_id,
      question: poll.question,
      total_votes: poll.total_votes,
      status: poll.status,
      expires_at: poll.expires_at,
      created_at: poll.created_at,
    };
  }
}
