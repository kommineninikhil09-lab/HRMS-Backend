import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { BaseRepository } from '../database/base.repository';

export interface CreateUserData {
  organizationId: string;
  email: string;
  passwordHash?: string;
  firstName?: string;
  lastName?: string;
  authProvider?: string;
  externalId?: string;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  passwordHash: string | null;
  authProvider: string;
  externalId: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

@Injectable()
export class UsersRepository extends BaseRepository {
  async create(
    data: CreateUserData,
    executor: Pool | PoolClient = this.pool,
  ): Promise<User> {
    const query = `
      INSERT INTO users (
        organization_id, email, password_hash, first_name, last_name,
        auth_provider, external_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      data.organizationId,
      data.email.toLowerCase(),
      data.passwordHash || null,
      data.firstName || null,
      data.lastName || null,
      data.authProvider || 'local',
      data.externalId || null,
      'active',
    ];

    const result = await this.query<User>(query, values, executor);
    return result.rows[0];
  }

  async findById(
    organizationId: string,
    userId: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<User | null> {
    const query = `
      SELECT * FROM users
      WHERE organization_id = $1 AND id = $2
    `;

    return this.queryOne<User>(query, [organizationId, userId], executor);
  }

  async findByEmail(
    email: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<User | null> {
    const query = `
      SELECT * FROM users
      WHERE LOWER(email) = LOWER($1)
    `;

    return this.queryOne<User>(query, [email], executor);
  }

  async findByEmailInOrganization(
    organizationId: string,
    email: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<User | null> {
    const query = `
      SELECT * FROM users
      WHERE organization_id = $1 AND LOWER(email) = LOWER($2)
    `;

    return this.queryOne<User>(
      query,
      [organizationId, email],
      executor,
    );
  }

  async findByOrganization(
    organizationId: string,
    limit: number = 50,
    offset: number = 0,
    executor: Pool | PoolClient = this.pool,
  ): Promise<{ users: User[]; total: number }> {
    const countQuery = `SELECT COUNT(*) as total FROM users WHERE organization_id = $1`;
    const dataQuery = `
      SELECT * FROM users
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countResult = await this.query<{ total: string }>(
      countQuery,
      [organizationId],
      executor,
    );
    const dataResult = await this.query<User>(
      dataQuery,
      [organizationId, limit, offset],
      executor,
    );

    return {
      users: dataResult.rows,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  async update(
    organizationId: string,
    userId: string,
    data: Partial<Omit<User, 'id' | 'organizationId' | 'createdAt' | 'createdBy'>>,
    updatedBy: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<User> {
    const setClauses: string[] = [];
    const values: any[] = [organizationId, userId, updatedBy];
    let paramIndex = 4;

    if (data.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      values.push(data.email.toLowerCase());
    }
    if (data.firstName !== undefined) {
      setClauses.push(`first_name = $${paramIndex++}`);
      values.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      setClauses.push(`last_name = $${paramIndex++}`);
      values.push(data.lastName);
    }
    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.passwordHash !== undefined) {
      setClauses.push(`password_hash = $${paramIndex++}`);
      values.push(data.passwordHash);
    }
    if (data.lastLoginAt !== undefined) {
      setClauses.push(`last_login_at = $${paramIndex++}`);
      values.push(data.lastLoginAt);
    }

    setClauses.push('updated_at = NOW()');
    setClauses.push(`updated_by = $3`);

    const query = `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE organization_id = $1 AND id = $2
      RETURNING *
    `;

    const result = await this.query<User>(query, values, executor);
    if (result.rows.length === 0) {
      throw new Error(`User not found: ${userId}`);
    }
    return result.rows[0];
  }

  async delete(
    organizationId: string,
    userId: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<void> {
    const query = `DELETE FROM users WHERE organization_id = $1 AND id = $2`;
    await this.query(query, [organizationId, userId], executor);
  }
}
