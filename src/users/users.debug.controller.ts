import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Pool } from 'pg';
import { Inject } from '@nestjs/common';
import { POOL_PROVIDER } from '../database/pool.provider';
import { TenantContext } from '../database/tenant-context';

@Controller('debug')
@UseGuards(JwtAuthGuard)
export class DebugController {
  constructor(@Inject(POOL_PROVIDER) private pool: Pool) {}

  @Get('/user-context')
  async getUserContext(@Request() req: any) {
    const tenantContext: TenantContext = req.tenantContext;
    return {
      userId: tenantContext.userId,
      organizationId: tenantContext.organizationId,
      requestId: tenantContext.requestId,
    };
  }

  @Get('/user-roles-raw')
  async getUserRolesRaw(@Request() req: any) {
    const tenantContext: TenantContext = req.tenantContext;

    const query = `
      SELECT ur.id, ur.user_id, ur.role_id, ur.organization_id, r.id as role_id_2, r.name
      FROM user_roles ur
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1
      LIMIT 10
    `;

    try {
      const result = await this.pool.query(query, [tenantContext.userId]);
      return {
        success: true,
        data: result.rows,
        rowCount: result.rowCount,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        hint: 'user_roles table might not exist',
      };
    }
  }

  @Get('/tables-check')
  async checkTables() {
    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('user_roles', 'roles', 'users', 'organizations')
      ORDER BY table_name
    `;

    try {
      const result = await this.pool.query<{ table_name: string }>(query);
      return {
        success: true,
        tables: result.rows.map(r => r.table_name),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
