import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Request,
  ForbiddenException,
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

    if (tenantContext.scope?.kind !== 'org') {
      throw new ForbiddenException('audit log access requires organization-wide scope');
    }

    // Ensure reasonable limits
    const safeLimit = Math.min(limit, 1000);
    const safeOffset = Math.max(offset, 0);

    const { logs, total } = await this.auditService['auditRepository'].findByOrganization(
      tenantContext.organizationId,
      safeLimit,
      safeOffset,
    );

    return {
      // old_value/new_value are jsonb columns — pg already returns them as
      // parsed objects, not strings. JSON.parse()'ing an object crashes
      // (implicitly stringifies to "[object Object]" first, which isn't
      // valid JSON), so any log row with a non-null value 500'd.
      logs,
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

    return logs;
  }
}
