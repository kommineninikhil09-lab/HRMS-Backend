import { Injectable } from '@nestjs/common';
import { LocationsRepository } from './locations.repository';
import { TenantContext } from '../database/tenant-context';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class LocationsService {
  constructor(private repo: LocationsRepository, private auditService: AuditService) {}
  async create(tc: TenantContext, data: any) {
    const loc = await this.repo.create(tc, data);
    await this.auditService.record(tc, { action: 'CREATE', entity_type: 'location', entity_id: loc.id, new_value: loc });
    return loc;
  }
  async getAll(tc: TenantContext) { return this.repo.findAll(tc); }
  async getById(tc: TenantContext, id: string) { return this.repo.findById(tc, id); }
  async update(tc: TenantContext, id: string, data: any) {
    const updated = await this.repo.update(tc, id, data);
    if (updated) await this.auditService.record(tc, { action: 'UPDATE', entity_type: 'location', entity_id: id, new_value: updated });
    return updated;
  }
  async delete(tc: TenantContext, id: string) {
    await this.repo.delete(tc, id);
    await this.auditService.record(tc, { action: 'DELETE', entity_type: 'location', entity_id: id });
  }
}
