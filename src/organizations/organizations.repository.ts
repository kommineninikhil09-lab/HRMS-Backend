import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { BaseRepository } from '../database/base.repository';

export interface Organization {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  status: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

@Injectable()
export class OrganizationsRepository extends BaseRepository {
  /**
   * Create an organization
   */
  async create(
    data: {
      name: string;
      legalName?: string;
      slug: string;
      status?: string;
      timezone?: string;
    },
    executor: Pool | PoolClient = this.pool,
  ): Promise<Organization> {
    const query = `
      INSERT INTO organizations (name, legal_name, slug, status, timezone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await this.query<Organization>(
      query,
      [
        data.name,
        data.legalName || null,
        data.slug,
        data.status || 'active',
        data.timezone || 'UTC',
      ],
      executor,
    );

    return result.rows[0];
  }

  /**
   * Find organization by ID
   */
  async findById(
    id: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<Organization | null> {
    const query = `SELECT * FROM organizations WHERE id = $1`;
    return this.queryOne<Organization>(query, [id], executor);
  }

  /**
   * Find organization by slug
   */
  async findBySlug(
    slug: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<Organization | null> {
    const query = `SELECT * FROM organizations WHERE slug = $1`;
    return this.queryOne<Organization>(query, [slug], executor);
  }

  /**
   * List all organizations
   */
  async findAll(
    limit: number = 100,
    offset: number = 0,
    executor: Pool | PoolClient = this.pool,
  ): Promise<Organization[]> {
    const query = `
      SELECT * FROM organizations
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await this.query<Organization>(query, [limit, offset], executor);
    return result.rows;
  }
}
