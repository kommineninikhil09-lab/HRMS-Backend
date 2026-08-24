import { Injectable } from '@nestjs/common';
import { CostCentersRepository } from './cost-centers.repository';
import { TenantContext } from '../database/tenant-context';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CostCentersService {
  constructor(private repo: CostCentersRepository, private auditService: AuditService) {}
  async create(tc: TenantContext, data: any) {
    const cc = await this.repo.create(tc, data);
    await this.auditService.record(tc, { action: 'CREATE', entity_type: 'cost_center', entity_id: cc.id, new_value: cc });
    return cc;
  }
  async getAll(tc: TenantContext) { return this.repo.findAll(tc); }
  async getById(tc: TenantContext, id: string) { return this.repo.findById(tc, id); }
  async update(tc: TenantContext, id: string, data: any) {
    const u = await this.repo.update(tc, id, data);
    if (u) await this.auditService.record(tc, { action: 'UPDATE', entity_type: 'cost_center', entity_id: id, new_value: u });
    return u;
  }
  async delete(tc: TenantContext, id: string) {
    await this.repo.delete(tc, id);
    await this.auditService.record(tc, { action: 'DELETE', entity_type: 'cost_center', entity_id: id });
  }
}
