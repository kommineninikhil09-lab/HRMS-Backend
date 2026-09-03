import { Injectable, NotFoundException } from '@nestjs/common';
import { HolidaysRepository, Holiday } from './holidays.repository';
import { TenantContext } from '../database/tenant-context';
import { AuditService } from '../audit/audit.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';

@Injectable()
export class HolidaysService {
  constructor(
    private readonly repository: HolidaysRepository,
    private readonly auditService: AuditService,
  ) {}

  async list(
    tenantContext: TenantContext,
    query: { year?: string; from?: string; to?: string },
  ): Promise<Holiday[]> {
    let { from, to } = query;
    if (query.year && /^\d{4}$/.test(query.year)) {
      from = `${query.year}-01-01`;
      to = `${query.year}-12-31`;
    }
    return this.repository.findByOrg(tenantContext, { from, to });
  }

  async create(
    tenantContext: TenantContext,
    dto: CreateHolidayDto,
  ): Promise<Holiday> {
    const holiday = await this.repository.create(tenantContext, dto);
    await this.auditService.record(tenantContext, {
      action: 'CREATE',
      entity_type: 'Holiday',
      entity_id: holiday.id,
      new_value: holiday,
    });
    return holiday;
  }

  async remove(tenantContext: TenantContext, id: string): Promise<void> {
    const existing = await this.repository.findById(tenantContext, id);
    if (!existing) {
      throw new NotFoundException('Holiday not found');
    }
    await this.repository.delete(tenantContext, id);
    await this.auditService.record(tenantContext, {
      action: 'DELETE',
      entity_type: 'Holiday',
      entity_id: id,
      old_value: existing,
    });
  }
}
