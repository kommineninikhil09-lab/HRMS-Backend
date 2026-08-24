import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';
import { Pool, PoolClient } from 'pg';

export interface Poll {
  id: string;
  organization_id: string;
  user_id: string;
  question: string;
  description?: string;
  notify_employees: boolean;
  is_anonymous: boolean;
  total_votes: number;
  status: string; // active, closed, draft
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  vote_count: number;
  order: number;
  created_at: Date;
}

export interface CreatePollDto {
  question: string;
  description?: string;
  options: string[]; // array of option texts
  notify_employees?: boolean;
  is_anonymous?: boolean;
  expires_at?: Date;
}

@Injectable()
export class PollsRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(tenantContext: TenantContext, data: CreatePollDto, executor?: Pool | PoolClient): Promise<Poll> {
    const query = `
      INSERT INTO polls (organization_id, user_id, question, description, notify_employees, is_anonymous, status, expires_at, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      tenantContext.organizationId,
      tenantContext.userId,
      data.question,
      data.description || null,
      data.notify_employees || false,
      data.is_anonymous || false,
      'active',
      data.expires_at || null,
      tenantContext.userId,
      tenantContext.userId,
    ];
    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as Poll;
  }

  async createWithOptions(tenantContext: TenantContext, data: CreatePollDto, executor?: Pool | PoolClient): Promise<{ poll: Poll; options: PollOption[] }> {
    const exec = executor || this.pool;
    const poll = await this.create(tenantContext, data, exec);

    const optionsQuery = `
      INSERT INTO poll_options (poll_id, option_text, "order")
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const options: PollOption[] = [];
    for (let i = 0; i < data.options.length; i++) {
      const result = await exec.query(optionsQuery, [poll.id, data.options[i], i]);
      options.push(result.rows[0] as PollOption);
    }

    return { poll, options };
  }

  async findById(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `SELECT * FROM polls WHERE id = $1 AND organization_id = $2`;
    const result = await (executor || this.pool).query(query, [id, tenantContext.organizationId]);
    return result.rows[0] as Poll | undefined;
  }

  async findByIdWithOptions(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const poll = await this.findById(tenantContext, id, executor);
    if (!poll) return null;

    const optionsQuery = `SELECT * FROM poll_options WHERE poll_id = $1 ORDER BY "order"`;
    const optionsResult = await (executor || this.pool).query(optionsQuery, [id]);
    const options = optionsResult.rows as PollOption[];

    return { poll, options };
  }

  async findByOrganization(tenantContext: TenantContext, status?: string, limit = 20, offset = 0, executor?: Pool | PoolClient) {
    let query = `
      SELECT * FROM polls
      WHERE organization_id = $1
    `;
    const values: any[] = [tenantContext.organizationId];
    let paramCount = 2;

    if (status) {
      query += ` AND status = $${paramCount++}`;
      values.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await (executor || this.pool).query(query, values);
    return result.rows as Poll[];
  }

  async update(tenantContext: TenantContext, id: string, data: Partial<CreatePollDto>, executor?: Pool | PoolClient) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.question !== undefined) {
      updates.push(`question = $${paramCount++}`);
      values.push(data.question);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(data.description);
    }

    updates.push(`updated_at = now(), updated_by = $${paramCount++}`);
    values.push(tenantContext.userId);
    values.push(id);
    values.push(tenantContext.organizationId);

    const query = `
      UPDATE polls
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND organization_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await (executor || this.pool).query(query, values);
    return result.rows[0] as Poll | undefined;
  }

  async closePoll(tenantContext: TenantContext, id: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE polls
      SET status = 'closed', updated_at = now(), updated_by = $1
      WHERE id = $2 AND organization_id = $3
      RETURNING *
    `;
    const result = await (executor || this.pool).query(query, [tenantContext.userId, id, tenantContext.organizationId]);
    return result.rows[0] as Poll | undefined;
  }

  async incrementVoteCount(pollOptionId: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE poll_options
      SET vote_count = vote_count + 1
      WHERE id = $1
      RETURNING vote_count
    `;
    const result = await (executor || this.pool).query(query, [pollOptionId]);
    return result.rows[0]?.vote_count;
  }

  async incrementTotalVotes(pollId: string, executor?: Pool | PoolClient) {
    const query = `
      UPDATE polls
      SET total_votes = total_votes + 1
      WHERE id = $1
      RETURNING total_votes
    `;
    const result = await (executor || this.pool).query(query, [pollId]);
    return result.rows[0]?.total_votes;
  }
}
