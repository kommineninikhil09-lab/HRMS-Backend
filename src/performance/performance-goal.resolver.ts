import { Injectable } from '@nestjs/common';
import { ResourceResolver } from '../common/authorization/resource-resolver.interface';
import { TenantContext } from '../database/tenant-context';
import { PerformanceGoalRepository } from './repositories/performance-goal.repository';

@Injectable()
export class PerformanceGoalResolver implements ResourceResolver {
  constructor(private readonly goalRepository: PerformanceGoalRepository) {}

  async resolveEmployeeId(tenantContext: TenantContext, resourceId: string): Promise<string | null> {
    // PerformanceGoalRepository.findById goes through
    // BaseRepository.queryOne, which camelCases columns (employee_id ->
    // employeeId).
    const goal = await this.goalRepository.findById(tenantContext, resourceId);
    return goal?.employeeId ?? null;
  }
}
