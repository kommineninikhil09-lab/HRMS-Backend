import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationsRepository, Organization } from './organizations.repository';

@Injectable()
export class OrganizationsService {
  constructor(private organizationsRepository: OrganizationsRepository) {}

  async getOrganizationById(id: string): Promise<Organization> {
    const org = await this.organizationsRepository.findById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization> {
    const org = await this.organizationsRepository.findBySlug(slug);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async listOrganizations(limit: number = 100, offset: number = 0): Promise<Organization[]> {
    return this.organizationsRepository.findAll(limit, offset);
  }
}
