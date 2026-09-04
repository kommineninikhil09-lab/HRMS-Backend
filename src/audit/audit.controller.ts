import {
  Controller,
  Get,
  Param,
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
      // old_value/new_value are jsonb columns — pg already parses them into
      // JS objects, so JSON.parse()'ing them again threw ""[object Object]"
      // is not valid JSON" on any log with a non-null value; confirmed live.
      logs: logs.map((log) => ({
        ...log,
        oldValue: typeof log.oldValue === 'string' ? JSON.parse(log.oldValue) : log.oldValue,
        newValue: typeof log.newValue === 'string' ? JSON.parse(log.newValue) : log.newValue,
      })),
      pagination: {
        limit: safeLimit,
        offset: safeOffset,
        total,
        hasMore: safeOffset + safeLimit < total,
      },
    };
  }

  // entityType/entityId are path segments, not query params — was reading
  // them via @Query(), so they were always undefined and the route
  // effectively required them as ?entityType=&entityId= query strings
  // instead of the documented /logs/entity/:entityType/:entityId path.
  @Get('logs/entity/:entityType/:entityId')
  @RequirePermissions('audit.read')
  async getEntityAuditLog(
    @Request() req,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
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
      oldValue: typeof log.oldValue === 'string' ? JSON.parse(log.oldValue) : log.oldValue,
      newValue: typeof log.newValue === 'string' ? JSON.parse(log.newValue) : log.newValue,
    }));
  }
}
