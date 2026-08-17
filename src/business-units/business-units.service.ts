import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { BusinessUnitsRepository } from './business-units.repository';
import { TenantContext } from '../database/tenant-context';
import { AuditService } from '../audit/audit.service';
import { TransactionService } from '../database/transaction.service';

export interface CreateBusinessUnitDTO {
  name: string;
  code: string;
  parent_business_unit_id?: string;
}

export interface UpdateBusinessUnitDTO {
  name?: string;
  code?: string;
  parent_business_unit_id?: string | null;
  status?: string;
}

@Injectable()
export class BusinessUnitsService {
  constructor(
    private readonly repository: BusinessUnitsRepository,
    private readonly auditService: AuditService,
    private readonly transactionService: TransactionService,
  ) {}

  async create(tenantContext: TenantContext, dto: CreateBusinessUnitDTO) {
    const existing = await this.repository.findByCode(tenantContext, dto.code);
    if (existing) {
      throw new BadRequestException(`Business unit code '${dto.code}' already exists`);
    }

    if (dto.parent_business_unit_id) {
      const parent = await this.repository.findById(tenantContext, dto.parent_business_unit_id);
      if (!parent) {
        throw new BadRequestException('Parent business unit not found');
      }
    }

    return this.transactionService.runInTransaction(async (client) => {
      const unit = await this.repository.create(tenantContext, dto, client);

      await this.auditService.record(tenantContext, {
        action: 'CREATE',
        entity_type: 'BusinessUnit',
        entity_id: unit.id,
        new_value: unit,
      }, client);

      return unit;
    });
  }

  async getById(tenantContext: TenantContext, id: string) {
    const unit = await this.repository.findById(tenantContext, id);
    if (!unit) {
      throw new NotFoundException('Business unit not found');
    }
    return unit;
  }

  async getAll(tenantContext: TenantContext, filters?: { status?: string }) {
    return this.repository.findAll(tenantContext, filters);
  }

  async getChildren(tenantContext: TenantContext, parentId: string) {
    const parent = await this.repository.findById(tenantContext, parentId);
    if (!parent) {
      throw new NotFoundException('Business unit not found');
    }
    return this.repository.findByParent(tenantContext, parentId);
  }

  async update(tenantContext: TenantContext, id: string, dto: UpdateBusinessUnitDTO) {
    const unit = await this.repository.findById(tenantContext, id);
    if (!unit) {
      throw new NotFoundException('Business unit not found');
    }

    if (dto.code && dto.code !== unit.code) {
      const existing = await this.repository.findByCode(tenantContext, dto.code);
      if (existing) {
        throw new BadRequestException(`Business unit code '${dto.code}' already exists`);
      }
    }

    if (dto.parent_business_unit_id !== undefined) {
      if (dto.parent_business_unit_id && dto.parent_business_unit_id !== unit.id) {
        const parent = await this.repository.findById(tenantContext, dto.parent_business_unit_id);
        if (!parent) {
          throw new BadRequestException('Parent business unit not found');
        }
      }
    }

    return this.transactionService.runInTransaction(async (client) => {
      const oldValue = { ...unit };
      // Convert DTO to data object, filtering out null values
      const updateData = Object.fromEntries(
        Object.entries(dto).filter(([, value]) => value !== null && value !== undefined)
      );
      const updated = await this.repository.update(tenantContext, id, updateData, client);

      await this.auditService.record(tenantContext, {
        action: 'UPDATE',
        entity_type: 'BusinessUnit',
        entity_id: id,
        old_value: oldValue,
        new_value: updated,
      }, client);

      return updated;
    });
  }

  async delete(tenantContext: TenantContext, id: string) {
    const unit = await this.repository.findById(tenantContext, id);
    if (!unit) {
      throw new NotFoundException('Business unit not found');
    }

    const children = await this.repository.findByParent(tenantContext, id);
    if (children.length > 0) {
      throw new BadRequestException('Cannot delete business unit with child units. Remove or reassign children first.');
    }

    return this.transactionService.runInTransaction(async (client) => {
      await this.auditService.record(tenantContext, {
        action: 'DELETE',
        entity_type: 'BusinessUnit',
        entity_id: id,
        old_value: unit,
      }, client);

      await this.repository.delete(tenantContext, id, client);
    });
  }
}
