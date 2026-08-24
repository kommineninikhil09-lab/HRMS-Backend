import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PraiseRepository, Praise, CreatePraiseDto } from '../repositories/praise.repository';
import { TenantContext } from '../../database/tenant-context';
import { AuditService } from '../../audit/audit.service';

const VALID_BADGE_TYPES = [
  'top_performer',
  'leadership_impact',
  'customer_hero',
  'above_beyond',
  'team_player',
  'rockstar_rookie',
  'legacy_builder',
  'all_day_everyday',
];

@Injectable()
export class PraiseService {
  constructor(private praiseRepository: PraiseRepository, private auditService: AuditService) {}

  async createPraise(tenantContext: TenantContext, data: CreatePraiseDto): Promise<Praise> {
    if (!VALID_BADGE_TYPES.includes(data.badge_type)) {
      throw new BadRequestException(`Invalid badge type. Must be one of: ${VALID_BADGE_TYPES.join(', ')}`);
    }

    if (!data.description || data.description.trim().length === 0) {
      throw new BadRequestException('Description cannot be empty');
    }

    const praise = await this.praiseRepository.create(tenantContext, data);

    await this.auditService.record(tenantContext, {
      action: 'CREATE',
      entity_type: 'Praise',
      entity_id: praise.id,
      new_value: praise,
    });

    return praise;
  }

  async getPraise(tenantContext: TenantContext, praiseId: string): Promise<Praise> {
    const praise = await this.praiseRepository.findById(tenantContext, praiseId);
    if (!praise) {
      throw new NotFoundException(`Praise ${praiseId} not found`);
    }
    return praise;
  }

  async listPraiseByOrganization(tenantContext: TenantContext, limit = 20, offset = 0): Promise<Praise[]> {
    return this.praiseRepository.findByOrganization(tenantContext, limit, offset);
  }

  async listPraiseForEmployee(tenantContext: TenantContext, employeeId: string, limit = 20, offset = 0): Promise<Praise[]> {
    return this.praiseRepository.findByToEmployee(tenantContext, employeeId, limit, offset);
  }

  async listPraiseFromUser(tenantContext: TenantContext, userId: string, limit = 20, offset = 0): Promise<Praise[]> {
    return this.praiseRepository.findByFromUser(tenantContext, userId, limit, offset);
  }

  async listPraiseByBadgeType(tenantContext: TenantContext, badgeType: string, limit = 20, offset = 0): Promise<Praise[]> {
    if (!VALID_BADGE_TYPES.includes(badgeType)) {
      throw new BadRequestException(`Invalid badge type. Must be one of: ${VALID_BADGE_TYPES.join(', ')}`);
    }
    return this.praiseRepository.findByBadgeType(tenantContext, badgeType, limit, offset);
  }

  async updatePraise(tenantContext: TenantContext, praiseId: string, data: Partial<CreatePraiseDto>): Promise<Praise> {
    const praise = await this.getPraise(tenantContext, praiseId);

    if (data.badge_type && !VALID_BADGE_TYPES.includes(data.badge_type)) {
      throw new BadRequestException(`Invalid badge type. Must be one of: ${VALID_BADGE_TYPES.join(', ')}`);
    }

    if (data.description && data.description.trim().length === 0) {
      throw new BadRequestException('Description cannot be empty');
    }

    const updated = await this.praiseRepository.update(tenantContext, praiseId, data);
    if (!updated) {
      throw new BadRequestException('Failed to update praise');
    }

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'Praise',
      entity_id: praiseId,
      old_value: praise,
      new_value: updated,
    });

    return updated;
  }

  async deletePraise(tenantContext: TenantContext, praiseId: string): Promise<void> {
    const praise = await this.getPraise(tenantContext, praiseId);

    await this.praiseRepository.delete(tenantContext, praiseId);

    await this.auditService.record(tenantContext, {
      action: 'DELETE',
      entity_type: 'Praise',
      entity_id: praiseId,
      old_value: praise,
    });
  }

  async addLike(tenantContext: TenantContext, praiseId: string): Promise<number> {
    await this.getPraise(tenantContext, praiseId);
    return this.praiseRepository.incrementLikesCount(praiseId);
  }

  async removeLike(tenantContext: TenantContext, praiseId: string): Promise<number> {
    await this.getPraise(tenantContext, praiseId);
    return this.praiseRepository.decrementLikesCount(praiseId);
  }

  async addComment(tenantContext: TenantContext, praiseId: string): Promise<number> {
    await this.getPraise(tenantContext, praiseId);
    return this.praiseRepository.incrementCommentsCount(praiseId);
  }

  async removeComment(tenantContext: TenantContext, praiseId: string): Promise<number> {
    await this.getPraise(tenantContext, praiseId);
    return this.praiseRepository.decrementCommentsCount(praiseId);
  }

  getValidBadgeTypes(): string[] {
    return VALID_BADGE_TYPES;
  }
}
