import { Controller, Get, UseGuards, Request, Param } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { TenantContext } from '../database/tenant-context';
import { Organization } from './organizations.repository';

@Controller('organizations')
export class OrganizationsController {
  constructor(private organizationsService: OrganizationsService) {}

  @Get('/current')
  @UseGuards(JwtAuthGuard)
  async getCurrentOrganization(
    @Request() req: any,
  ): Promise<{ success: boolean; data: Organization }> {
    const tenantContext: TenantContext = req.tenantContext;
    const org = await this.organizationsService.getOrganizationById(
      tenantContext.organizationId,
    );

    return {
      success: true,
      data: org,
    };
  }

  @Get('/:id')
  @Public()
  async getOrganization(
    @Param('id') id: string,
  ): Promise<{ success: boolean; data: Organization }> {
    const org = await this.organizationsService.getOrganizationById(id);

    return {
      success: true,
      data: org,
    };
  }

  @Get()
  @Public()
  async listOrganizations(): Promise<{ success: boolean; data: Organization[] }> {
    const orgs = await this.organizationsService.listOrganizations(100, 0);

    return {
      success: true,
      data: orgs,
    };
  }
}
