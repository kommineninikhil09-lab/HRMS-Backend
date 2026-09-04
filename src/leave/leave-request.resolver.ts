import { Injectable } from '@nestjs/common';
import { ResourceResolver } from '../common/authorization/resource-resolver.interface';
import { TenantContext } from '../database/tenant-context';
import { LeaveRequestsRepository } from './leave-requests.repository';

@Injectable()
export class LeaveRequestResolver implements ResourceResolver {
  constructor(private readonly leaveRequestsRepo: LeaveRequestsRepository) {}

  async resolveEmployeeId(tenantContext: TenantContext, resourceId: string): Promise<string | null> {
    const request = await this.leaveRequestsRepo.findById(tenantContext, resourceId);
    return request?.employee_id ?? null;
  }
}
