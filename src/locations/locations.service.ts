import { Injectable, NotFoundException } from '@nestjs/common';
import { LocationsRepository } from './locations.repository';
import { TenantContext } from '../database/tenant-context';
import { AuditService } from '../audit/audit.service';
import { TransactionService } from '../database/transaction.service';

@Injectable()
export class LocationsService {
  constructor(
    private repository: LocationsRepository,
    private auditService: AuditService,
    private transactionService: TransactionService,
  ) {}

  async create(tenantContext: TenantContext, data: any) {
    return this.transactionService.runInTransaction(async (client) => {
      const location = await this.repository.create(tenantContext, data, client);
      await this.auditService.record(tenantContext, {
        action: 'CREATE',
        entity_type: 'Location',
        entity_id: location.id,
        new_value: location,
      }, client);
      return location;
    });
  }

  async getById(tenantContext: TenantContext, id: string) {
    const location = await this.repository.findById(tenantContext, id);
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }

  async getAll(tenantContext: TenantContext) {
    return this.repository.findAll(tenantContext);
  }

  async update(tenantContext: TenantContext, id: string, data: any) {
    const location = await this.repository.findById(tenantContext, id);
    if (!location) throw new NotFoundException('Location not found');

    return this.transactionService.runInTransaction(async (client) => {
      const updated = await this.repository.update(tenantContext, id, data, client);
      await this.auditService.record(tenantContext, {
        action: 'UPDATE',
        entity_type: 'Location',
        entity_id: id,
        old_value: location,
        new_value: updated,
      }, client);
      return updated;
    });
  }

  async delete(tenantContext: TenantContext, id: string) {
    const location = await this.repository.findById(tenantContext, id);
    if (!location) throw new NotFoundException('Location not found');

    return this.transactionService.runInTransaction(async (client) => {
      await this.auditService.record(tenantContext, {
        action: 'DELETE',
        entity_type: 'Location',
        entity_id: id,
        old_value: location,
      }, client);
      await this.repository.delete(tenantContext, id, client);
    });
  }
}
