import { Injectable } from '@nestjs/common';
import { DepartmentsRepository } from './departments.repository';
import { TenantContext } from '../database/tenant-context';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class DepartmentsService {
  constructor(private repo: DepartmentsRepository, private auditService: AuditService) {}
  async create(tc: TenantContext, data: any) {
    const d = await this.repo.create(tc, data);
    await this.auditService.record(tc, { action: 'CREATE', entity_type: 'department', entity_id: d.id, new_value: d });
    return d;
  }
  async getAll(tc: TenantContext) { return this.repo.findAll(tc); }
  async getById(tc: TenantContext, id: string) { return this.repo.findById(tc, id); }
  async update(tc: TenantContext, id: string, data: any) {
    const u = await this.repo.update(tc, id, data);
    if (u) await this.auditService.record(tc, { action: 'UPDATE', entity_type: 'department', entity_id: id, new_value: u });
    return u;
  }
  async delete(tc: TenantContext, id: string) {
    await this.repo.delete(tc, id);
    await this.auditService.record(tc, { action: 'DELETE', entity_type: 'department', entity_id: id });
  }
}
