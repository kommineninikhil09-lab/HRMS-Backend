import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base.repository';
import { TenantContext } from '../../database/tenant-context';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class AppraisalRatingRepository extends BaseRepository {
  async addRating(
    tenantContext: TenantContext,
    data: any,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      INSERT INTO appraisal_ratings
      (organization_id, appraisal_id, question_id, reviewer_id, reviewer_type, rating_value, comments, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
      ON CONFLICT (organization_id, appraisal_id, question_id, reviewer_id)
      DO UPDATE SET rating_value = $6, comments = $7, updated_at = now()
      RETURNING *;
    `;

    return this.queryOne<any>(
      sql,
      [
        tenantContext.organizationId,
        data.appraisal_id,
        data.question_id,
        data.reviewer_id,
        data.reviewer_type,
        data.rating_value,
        data.comments,
      ],
      executor,
    );
  }

  async findByAppraisal(
    tenantContext: TenantContext,
    appraisalId: string,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      SELECT ar.*, q.question_text, q.rating_scale
      FROM appraisal_ratings ar
      JOIN appraisal_questions q ON q.id = ar.question_id
      WHERE ar.organization_id = $1 AND ar.appraisal_id = $2
      ORDER BY q.question_order;
    `;

    return this.query<any>(sql, [tenantContext.organizationId, appraisalId], executor);
  }

  async findByAppraisalAndReviewer(
    tenantContext: TenantContext,
    appraisalId: string,
    reviewerId: string,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      SELECT * FROM appraisal_ratings
      WHERE organization_id = $1 AND appraisal_id = $2 AND reviewer_id = $3;
    `;

    return this.query<any>(
      sql,
      [tenantContext.organizationId, appraisalId, reviewerId],
      executor,
    );
  }

  async getAverageRatingByReviewerType(
    tenantContext: TenantContext,
    appraisalId: string,
    reviewerType: string,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      SELECT AVG(rating_value)::numeric(5,2) as average_rating, COUNT(*) as rater_count
      FROM appraisal_ratings
      WHERE organization_id = $1 AND appraisal_id = $2 AND reviewer_type = $3;
    `;

    return this.queryOne<{ average_rating: number; rater_count: number }>(
      sql,
      [tenantContext.organizationId, appraisalId, reviewerType],
      executor,
    );
  }

  async deleteRating(
    tenantContext: TenantContext,
    ratingId: string,
    executor?: Pool | PoolClient,
  ) {
    const sql = `
      DELETE FROM appraisal_ratings
      WHERE id = $1 AND organization_id = $2;
    `;

    await this.query(sql, [ratingId, tenantContext.organizationId], executor);
  }
}
