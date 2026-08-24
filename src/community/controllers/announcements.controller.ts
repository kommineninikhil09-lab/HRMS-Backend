import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AnnouncementsService } from '../services/announcements.service';
import { CreateAnnouncementRequestDto, UpdateAnnouncementRequestDto, PublishAnnouncementRequestDto, AnnouncementResponseDto, AnnouncementListResponseDto } from '../dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { TenantContext } from '../../database/tenant-context';

@Controller('community/announcements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AnnouncementsController {
  constructor(private announcementsService: AnnouncementsService) {}

  @Post()
  @RequirePermissions('announcement.create')
  async createAnnouncement(
    @CurrentUser() tenantContext: TenantContext,
    @Body() dto: CreateAnnouncementRequestDto,
  ): Promise<AnnouncementResponseDto> {
    const announcement = await this.announcementsService.createAnnouncement(tenantContext, dto);
    return this.mapToResponse(announcement);
  }

  @Get()
  @RequirePermissions('announcement.read')
  async listAnnouncements(
    @CurrentUser() tenantContext: TenantContext,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<AnnouncementListResponseDto[]> {
    const announcements = await this.announcementsService.listAnnouncementsByOrganization(
      tenantContext,
      status,
      parseInt(limit || '20'),
      parseInt(offset || '0'),
    );
    return announcements.map((a) => this.mapToListResponse(a));
  }

  @Get('active')
  @RequirePermissions('announcement.read')
  async listActiveAnnouncements(
    @CurrentUser() tenantContext: TenantContext,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<AnnouncementListResponseDto[]> {
    const announcements = await this.announcementsService.listActiveAnnouncements(tenantContext, parseInt(limit || '20'), parseInt(offset || '0'));
    return announcements.map((a) => this.mapToListResponse(a));
  }

  @Get(':id')
  @RequirePermissions('announcement.read')
  async getAnnouncement(@CurrentUser() tenantContext: TenantContext, @Param('id') id: string): Promise<AnnouncementResponseDto> {
    const announcement = await this.announcementsService.getAnnouncement(tenantContext, id);
    return this.mapToResponse(announcement);
  }

  @Put(':id')
  @RequirePermissions('announcement.update')
  async updateAnnouncement(
    @CurrentUser() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementRequestDto,
  ): Promise<AnnouncementResponseDto> {
    const announcement = await this.announcementsService.updateAnnouncement(tenantContext, id, dto);
    return this.mapToResponse(announcement);
  }

  @Post(':id/publish')
  @RequirePermissions('announcement.update')
  async publishAnnouncement(
    @CurrentUser() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto?: PublishAnnouncementRequestDto,
  ): Promise<AnnouncementResponseDto> {
    const announcement = await this.announcementsService.publishAnnouncement(tenantContext, id);
    return this.mapToResponse(announcement);
  }

  @Post(':id/schedule')
  @RequirePermissions('announcement.update')
  async scheduleAnnouncement(
    @CurrentUser() tenantContext: TenantContext,
    @Param('id') id: string,
    @Body() dto: PublishAnnouncementRequestDto,
  ): Promise<AnnouncementResponseDto> {
    if (!dto.publish_at) {
      throw new Error('publish_at date is required');
    }
    const announcement = await this.announcementsService.scheduleAnnouncement(tenantContext, id, new Date(dto.publish_at));
    return this.mapToResponse(announcement);
  }

  @Delete(':id')
  @RequirePermissions('announcement.delete')
  async deleteAnnouncement(@CurrentUser() tenantContext: TenantContext, @Param('id') id: string): Promise<{ success: boolean }> {
    await this.announcementsService.deleteAnnouncement(tenantContext, id);
    return { success: true };
  }

  @Get('metadata/priorities')
  @RequirePermissions('announcement.read')
  async getPriorities(): Promise<{ priorities: string[] }> {
    return { priorities: this.announcementsService.getValidPriorities() };
  }

  @Get('metadata/statuses')
  @RequirePermissions('announcement.read')
  async getStatuses(): Promise<{ statuses: string[] }> {
    return { statuses: this.announcementsService.getValidStatuses() };
  }

  private mapToResponse(announcement: any): AnnouncementResponseDto {
    return {
      id: announcement.id,
      organization_id: announcement.organization_id,
      created_by_user_id: announcement.created_by_user_id,
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      status: announcement.status,
      published_at: announcement.published_at,
      expires_at: announcement.expires_at,
      created_at: announcement.created_at,
      updated_at: announcement.updated_at,
    };
  }

  private mapToListResponse(announcement: any): AnnouncementListResponseDto {
    return {
      id: announcement.id,
      organization_id: announcement.organization_id,
      created_by_user_id: announcement.created_by_user_id,
      title: announcement.title,
      priority: announcement.priority,
      status: announcement.status,
      published_at: announcement.published_at,
      expires_at: announcement.expires_at,
      created_at: announcement.created_at,
    };
  }
}
