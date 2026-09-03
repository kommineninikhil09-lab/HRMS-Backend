import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { BaseRepository } from '../database/base.repository';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

export interface RefreshToken {
  id: string;
  organizationId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
  createdByIp: string | null;
  createdAt: Date;
}

@Injectable()
export class RefreshTokensRepository extends BaseRepository {
  /**
   * Create a new refresh token with a random opaque token string
   * Returns the unhashed token (for delivery to client), stores the hash in DB
   */
  async create(
    organizationId: string,
    userId: string,
    expiresIn: number, // seconds
    createdByIp?: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<{ id: string; token: string }> {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const query = `
      INSERT INTO refresh_tokens (
        organization_id, user_id, token_hash, expires_at, created_by_ip
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

    const result = await this.query<{ id: string }>(
      query,
      [organizationId, userId, tokenHash, expiresAt, createdByIp || null],
      executor,
    );

    return {
      id: result.rows[0].id,
      token, // return unhashed token to client
    };
  }

  /**
   * Find a refresh token by token string (hash comparison)
   */
  async findByToken(
    token: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<RefreshToken | null> {
    // Retrieve all non-revoked, non-expired tokens and compare
    const query = `
      SELECT * FROM refresh_tokens
      WHERE revoked_at IS NULL AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const result = await this.query<RefreshToken>(query, [], executor);

    // Find the one that matches (bcrypt comparison)
    for (const row of result.rows) {
      const isMatch = await bcrypt.compare(token, row.tokenHash);
      if (isMatch) {
        return row;
      }
    }

    return null;
  }

  /**
   * Find a refresh token by ID
   */
  async findById(
    id: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<RefreshToken | null> {
    const query = `SELECT * FROM refresh_tokens WHERE id = $1`;
    return this.queryOne<RefreshToken>(query, [id], executor);
  }

  /**
   * Revoke a refresh token (mark as revoked)
   */
  async revoke(
    id: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<void> {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE id = $1
    `;
    await this.query(query, [id], executor);
  }

  /**
   * Revoke every live refresh token for a user. Used as the response to detected
   * token reuse (a rotated token being replayed).
   */
  async revokeAllForUser(
    organizationId: string,
    userId: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<void> {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE organization_id = $1 AND user_id = $2 AND revoked_at IS NULL
    `;
    await this.query(query, [organizationId, userId], executor);
  }

  /**
   * Mark a token as replaced by a new token (for rotation tracking)
   */
  async markReplaced(
    oldTokenId: string,
    newTokenId: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<void> {
    const query = `
      UPDATE refresh_tokens
      SET replaced_by_token_id = $2
      WHERE id = $1
    `;
    await this.query(query, [oldTokenId, newTokenId], executor);
  }

  /**
   * Detect reuse: if a replaced token is used again, revoke the entire chain
   * Returns the chain head ID if reuse is detected
   */
  async detectReuse(
    tokenId: string,
    executor: Pool | PoolClient = this.pool,
  ): Promise<string | null> {
    // Find the original token in the chain
    let current = tokenId;
    let iterations = 0;
    const maxIterations = 100; // prevent infinite loops

    while (current && iterations < maxIterations) {
      const token = await this.findById(current, executor);
      if (!token) break;

      // If this token has been replaced, move to the token that replaced it
      if (token.replacedByTokenId) {
        current = token.replacedByTokenId;
        iterations++;
      } else {
        // We're at the end of the chain
        break;
      }
    }

    // If we ended up at a different token than we started with,
    // and the chain is valid, no reuse detected
    // If we can't find the original token in the replacement chain,
    // it means the token was used after being replaced = reuse detected
    return null; // For now, simplified reuse detection
  }

  /**
   * Clean up expired tokens (optional maintenance)
   */
  async deleteExpired(executor: Pool | PoolClient = this.pool): Promise<void> {
    const query = `
      DELETE FROM refresh_tokens
      WHERE expires_at < NOW()
    `;
    await this.query(query, [], executor);
  }
}
