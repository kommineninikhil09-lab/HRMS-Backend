import { Injectable } from '@nestjs/common';
import { ResourceResolver } from '../common/authorization/resource-resolver.interface';
import { TenantContext } from '../database/tenant-context';
import { SalarySlipRepository } from './repositories/salary-slip.repository';

@Injectable()
export class SalarySlipResolver implements ResourceResolver {
  constructor(private readonly salarySlipRepository: SalarySlipRepository) {}

  async resolveEmployeeId(tenantContext: TenantContext, resourceId: string): Promise<string | null> {
    // SalarySlipRepository.findById goes through BaseRepository.queryOne,
    // which camelCases columns (employee_id -> employeeId) — unlike
    // LeaveRequestsRepository, which queries raw and stays snake_case.
    const slip: any = await this.salarySlipRepository.findById(tenantContext, resourceId);
    return slip?.employeeId ?? null;
  }
}
