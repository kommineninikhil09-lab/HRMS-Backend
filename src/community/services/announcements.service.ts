import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AnnouncementsRepository, Announcement, CreateAnnouncementDto } from '../repositories/announcements.repository';
import { TenantContext } from '../../database/tenant-context';
import { AuditService } from '../../audit/audit.service';

const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_STATUSES = ['published', 'scheduled', 'draft', 'archived'];

@Injectable()
export class AnnouncementsService {
  constructor(private announcementsRepository: AnnouncementsRepository, private auditService: AuditService) {}

  async createAnnouncement(tenantContext: TenantContext, data: CreateAnnouncementDto): Promise<Announcement> {
    if (!data.title || data.title.trim().length === 0) {
      throw new BadRequestException('Title cannot be empty');
    }

    if (!data.content || data.content.trim().length === 0) {
      throw new BadRequestException('Content cannot be empty');
    }

    if (data.priority && !VALID_PRIORITIES.includes(data.priority)) {
      throw new BadRequestException(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }

    if (data.status && !VALID_STATUSES.includes(data.status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const announcement = await this.announcementsRepository.create(tenantContext, data);

    await this.auditService.record(tenantContext, {
      action: 'CREATE',
      entity_type: 'Announcement',
      entity_id: announcement.id,
      new_value: announcement,
    });

    return announcement;
  }

  async getAnnouncement(tenantContext: TenantContext, announcementId: string): Promise<Announcement> {
    const announcement = await this.announcementsRepository.findById(tenantContext, announcementId);
    if (!announcement) {
      throw new NotFoundException(`Announcement ${announcementId} not found`);
    }
    return announcement;
  }

  async listAnnouncementsByOrganization(tenantContext: TenantContext, status?: string, limit = 20, offset = 0): Promise<Announcement[]> {
    if (status && !VALID_STATUSES.includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    return this.announcementsRepository.findByOrganization(tenantContext, status, limit, offset);
  }

  async listActiveAnnouncements(tenantContext: TenantContext, limit = 20, offset = 0): Promise<Announcement[]> {
    return this.announcementsRepository.findActive(tenantContext, limit, offset);
  }

  async listAnnouncementsByCreator(tenantContext: TenantContext, userId: string, limit = 20, offset = 0): Promise<Announcement[]> {
    return this.announcementsRepository.findByCreator(tenantContext, userId, limit, offset);
  }

  async updateAnnouncement(tenantContext: TenantContext, announcementId: string, data: Partial<CreateAnnouncementDto>): Promise<Announcement> {
    const announcement = await this.getAnnouncement(tenantContext, announcementId);

    if (data.title && data.title.trim().length === 0) {
      throw new BadRequestException('Title cannot be empty');
    }

    if (data.content && data.content.trim().length === 0) {
      throw new BadRequestException('Content cannot be empty');
    }

    if (data.priority && !VALID_PRIORITIES.includes(data.priority)) {
      throw new BadRequestException(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }

    if (data.status && !VALID_STATUSES.includes(data.status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const updated = await this.announcementsRepository.update(tenantContext, announcementId, data);
    if (!updated) {
      throw new BadRequestException('Failed to update announcement');
    }

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'Announcement',
      entity_id: announcementId,
      old_value: announcement,
      new_value: updated,
    });

    return updated;
  }

  async publishAnnouncement(tenantContext: TenantContext, announcementId: string): Promise<Announcement> {
    const announcement = await this.getAnnouncement(tenantContext, announcementId);

    const published = await this.announcementsRepository.publish(tenantContext, announcementId);
    if (!published) {
      throw new BadRequestException('Announcement cannot be published. It must be in draft or scheduled status.');
    }

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'Announcement',
      entity_id: announcementId,
      old_value: announcement,
      new_value: published,
    });

    return published;
  }

  async scheduleAnnouncement(tenantContext: TenantContext, announcementId: string, publishAt: Date): Promise<Announcement> {
    if (publishAt <= new Date()) {
      throw new BadRequestException('Publish date must be in the future');
    }

    const announcement = await this.getAnnouncement(tenantContext, announcementId);

    const scheduled = await this.announcementsRepository.schedule(tenantContext, announcementId, publishAt);
    if (!scheduled) {
      throw new BadRequestException('Announcement cannot be scheduled. It must be in draft or scheduled status.');
    }

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'Announcement',
      entity_id: announcementId,
      old_value: announcement,
      new_value: scheduled,
    });

    return scheduled;
  }

  async deleteAnnouncement(tenantContext: TenantContext, announcementId: string): Promise<void> {
    const announcement = await this.getAnnouncement(tenantContext, announcementId);

    await this.announcementsRepository.delete(tenantContext, announcementId);

    await this.auditService.record(tenantContext, {
      action: 'DELETE',
      entity_type: 'Announcement',
      entity_id: announcementId,
      old_value: announcement,
    });
  }

  getValidPriorities(): string[] {
    return VALID_PRIORITIES;
  }

  getValidStatuses(): string[] {
    return VALID_STATUSES;
  }
}
