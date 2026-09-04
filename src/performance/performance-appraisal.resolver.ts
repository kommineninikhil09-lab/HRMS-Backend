import { Injectable } from '@nestjs/common';
import { ResourceResolver } from '../common/authorization/resource-resolver.interface';
import { TenantContext } from '../database/tenant-context';
import { PerformanceAppraisalRepository } from './repositories/performance-appraisal.repository';

@Injectable()
export class PerformanceAppraisalResolver implements ResourceResolver {
  constructor(private readonly appraisalRepository: PerformanceAppraisalRepository) {}

  async resolveEmployeeId(tenantContext: TenantContext, resourceId: string): Promise<string | null> {
    // PerformanceAppraisalRepository.findById goes through
    // BaseRepository.queryOne, which camelCases columns (employee_id ->
    // employeeId).
    const appraisal = await this.appraisalRepository.findById(tenantContext, resourceId);
    return appraisal?.employeeId ?? null;
  }
}
