import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Request,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { TenantContext } from '../database/tenant-context';

@Controller('audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('logs')
  @RequirePermissions('audit.read')
  async listAuditLogs(
    @Request() req,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    const tenantContext: TenantContext = req.tenantContext;

    // Ensure reasonable limits
    const safeLimit = Math.min(limit, 1000);
    const safeOffset = Math.max(offset, 0);

    const { logs, total } = await this.auditService['auditRepository'].findByOrganization(
      tenantContext.organizationId,
      safeLimit,
      safeOffset,
    );

    return {
      logs: logs.map((log) => ({
        ...log,
        oldValue: log.oldValue ? JSON.parse(log.oldValue as any) : null,
        newValue: log.newValue ? JSON.parse(log.newValue as any) : null,
      })),
      pagination: {
        limit: safeLimit,
        offset: safeOffset,
        total,
        hasMore: safeOffset + safeLimit < total,
      },
    };
  }

  @Get('logs/entity/:entityType/:entityId')
  @RequirePermissions('audit.read')
  async getEntityAuditLog(
    @Request() req,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const tenantContext: TenantContext = req.tenantContext;
    const safeLimit = Math.min(limit, 500);

    const logs = await this.auditService['auditRepository'].findByEntity(
      tenantContext.organizationId,
      entityType,
      entityId,
      safeLimit,
    );

    return logs.map((log) => ({
      ...log,
      oldValue: log.oldValue ? JSON.parse(log.oldValue as any) : null,
      newValue: log.newValue ? JSON.parse(log.newValue as any) : null,
    }));
  }
}
