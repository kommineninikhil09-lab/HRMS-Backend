import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TenantContext } from '../database/tenant-context';
import { TransactionService } from '../database/transaction.service';
import { AuditService } from '../audit/audit.service';
import { PerformanceCycleRepository } from './repositories/performance-cycle.repository';
import { AppraisalTemplateRepository } from './repositories/appraisal-template.repository';
import { PerformanceAppraisalRepository } from './repositories/performance-appraisal.repository';
import { AppraisalRatingRepository } from './repositories/appraisal-rating.repository';
import { CompetencyRepository } from './repositories/competency.repository';
import { PerformanceGoalRepository } from './repositories/performance-goal.repository';

@Injectable()
export class PerformanceService {
  constructor(
    private readonly cycleRepository: PerformanceCycleRepository,
    private readonly templateRepository: AppraisalTemplateRepository,
    private readonly appraisalRepository: PerformanceAppraisalRepository,
    private readonly ratingRepository: AppraisalRatingRepository,
    private readonly competencyRepository: CompetencyRepository,
    private readonly goalRepository: PerformanceGoalRepository,
    private readonly auditService: AuditService,
    private readonly transactionService: TransactionService,
  ) {}

  // Performance Cycles
  async createCycle(tenantContext: TenantContext, dto: any) {
    const cycle = await this.cycleRepository.create(tenantContext, {
      name: dto.name,
      cycle_type: dto.cycle_type,
      start_date: dto.start_date,
      end_date: dto.end_date,
      status: 'draft',
    });

    await this.auditService.record(tenantContext, {
      action: 'CREATE',
      entity_type: 'PerformanceCycle',
      entity_id: cycle.id,
      new_value: cycle,
    });

    return cycle;
  }

  async getCycles(tenantContext: TenantContext) {
    return this.cycleRepository.findAll(tenantContext);
  }

  async getCycle(tenantContext: TenantContext, id: string) {
    const cycle = await this.cycleRepository.findById(tenantContext, id);
    if (!cycle) {
      throw new NotFoundException('Performance cycle not found');
    }
    return cycle;
  }

  async updateCycle(tenantContext: TenantContext, id: string, dto: any) {
    const old = await this.cycleRepository.findById(tenantContext, id);
    if (!old) {
      throw new NotFoundException('Performance cycle not found');
    }

    const updated = await this.cycleRepository.update(tenantContext, id, {
      name: dto.name,
      status: dto.status,
      end_date: dto.end_date,
    });

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'PerformanceCycle',
      entity_id: id,
      old_value: old,
      new_value: updated,
    });

    return updated;
  }

  // Appraisal Templates
  async createTemplate(tenantContext: TenantContext, dto: any) {
    const template = await this.templateRepository.create(tenantContext, {
      name: dto.name,
      description: dto.description,
      template_type: dto.template_type,
      rating_scale: dto.rating_scale,
    });

    await this.auditService.record(tenantContext, {
      action: 'CREATE',
      entity_type: 'AppraisalTemplate',
      entity_id: template.id,
      new_value: template,
    });

    return template;
  }

  async getTemplates(tenantContext: TenantContext) {
    return this.templateRepository.findAll(tenantContext);
  }

  async getTemplate(tenantContext: TenantContext, id: string) {
    const template = await this.templateRepository.findById(tenantContext, id);
    if (!template) {
      throw new NotFoundException('Appraisal template not found');
    }
    return template;
  }

  async updateTemplate(tenantContext: TenantContext, id: string, dto: any) {
    const old = await this.templateRepository.findById(tenantContext, id);
    if (!old) {
      throw new NotFoundException('Appraisal template not found');
    }

    const updated = await this.templateRepository.update(tenantContext, id, {
      name: dto.name,
      description: dto.description,
      is_active: dto.is_active,
    });

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'AppraisalTemplate',
      entity_id: id,
      old_value: old,
      new_value: updated,
    });

    return updated;
  }

  // Performance Appraisals (Core)
  async createAppraisal(tenantContext: TenantContext, dto: any) {
    const cycle = await this.cycleRepository.findById(tenantContext, dto.cycle_id);
    if (!cycle) {
      throw new NotFoundException('Performance cycle not found');
    }

    const template = await this.templateRepository.findById(tenantContext, dto.template_id);
    if (!template) {
      throw new NotFoundException('Appraisal template not found');
    }

    const appraisal = await this.appraisalRepository.create(tenantContext, {
      cycle_id: dto.cycle_id,
      employee_id: dto.employee_id,
      template_id: dto.template_id,
      manager_id: dto.manager_id,
      appraisal_type: dto.appraisal_type,
      status: 'draft',
    });

    await this.auditService.record(tenantContext, {
      action: 'CREATE',
      entity_type: 'PerformanceAppraisal',
      entity_id: appraisal.id,
      new_value: appraisal,
    });

    return appraisal;
  }

  async getAppraisals(tenantContext: TenantContext, filters?: any) {
    const scopedIds = tenantContext.scopedEmployeeIds;

    if (filters?.cycle_id) {
      return this.appraisalRepository.findByCycle(tenantContext, filters.cycle_id, scopedIds);
    }
    if (filters?.status) {
      return this.appraisalRepository.findByStatus(tenantContext, filters.status, scopedIds);
    }
    if (filters?.employee_id) {
      // employee_id is a caller-supplied query filter, not a URL param, so
      // ScopeGuard's @ScopeParam can't gate it directly (it would also wrongly
      // require employee_id on the cycle_id/status filter modes above, which
      // don't take one) — check it against the resolved scope set here instead.
      if (scopedIds && scopedIds !== 'ALL' && !scopedIds.includes(filters.employee_id)) {
        throw new ForbiddenException('Employee is outside your permission scope');
      }
      return this.appraisalRepository.findByEmployee(tenantContext, filters.employee_id);
    }
    return [];
  }

  async getAppraisal(tenantContext: TenantContext, id: string) {
    const appraisal = await this.appraisalRepository.findById(tenantContext, id);
    if (!appraisal) {
      throw new NotFoundException('Performance appraisal not found');
    }
    return appraisal;
  }

  // Rating Calculation Algorithm
  async submitRating(tenantContext: TenantContext, appraisalId: string, dto: any) {
    return this.transactionService.runInTransaction(async (client) => {
      const appraisal = await this.appraisalRepository.findById(tenantContext, appraisalId, client);
      if (!appraisal) {
        throw new NotFoundException('Performance appraisal not found');
      }

      const rating = await this.ratingRepository.addRating(
        tenantContext,
        {
          appraisal_id: appraisalId,
          question_id: dto.question_id,
          reviewer_id: tenantContext.userId,
          reviewer_type: dto.reviewer_type,
          rating_value: dto.rating_value,
          comments: dto.comments,
        },
        client,
      );

      // Recalculate overall rating
      await this.recalculateAppraisalRating(tenantContext, appraisalId, client);

      await this.auditService.record(
        tenantContext,
        {
          action: 'CREATE',
          entity_type: 'AppraisalRating',
          entity_id: rating.id,
          new_value: rating,
        },
        client,
      );

      return rating;
    });
  }

  // Multi-Rater Rating Calculation
  private async recalculateAppraisalRating(
    tenantContext: TenantContext,
    appraisalId: string,
    client: any,
  ) {
    const selfRating = await this.ratingRepository.getAverageRatingByReviewerType(
      tenantContext,
      appraisalId,
      'self',
      client,
    );
    const managerRating = await this.ratingRepository.getAverageRatingByReviewerType(
      tenantContext,
      appraisalId,
      'manager',
      client,
    );
    const peerRating = await this.ratingRepository.getAverageRatingByReviewerType(
      tenantContext,
      appraisalId,
      'peer',
      client,
    );
    const hrRating = await this.ratingRepository.getAverageRatingByReviewerType(
      tenantContext,
      appraisalId,
      'hr',
      client,
    );

    // Weighted calculation
    // Self: 10%, Manager: 50%, Peer: 25%, HR: 15%
    let overallRating = 0;
    let hasRating = false;

    if (selfRating?.average_rating) {
      overallRating += selfRating.average_rating * 0.1;
      hasRating = true;
    }
    if (managerRating?.average_rating) {
      overallRating += managerRating.average_rating * 0.5;
      hasRating = true;
    }
    if (peerRating?.average_rating) {
      overallRating += peerRating.average_rating * 0.25;
      hasRating = true;
    }
    if (hrRating?.average_rating) {
      overallRating += hrRating.average_rating * 0.15;
      hasRating = true;
    }

    if (hasRating) {
      await this.appraisalRepository.update(
        tenantContext,
        appraisalId,
        {
          overall_rating: Math.round(overallRating * 100) / 100,
          self_rating: selfRating?.average_rating,
          manager_rating: managerRating?.average_rating,
          peer_rating: peerRating?.average_rating,
          hr_rating: hrRating?.average_rating,
        },
        client,
      );
    }
  }

  // Workflow State Transitions
  async submitAppraisal(tenantContext: TenantContext, appraisalId: string) {
    const appraisal = await this.appraisalRepository.findById(tenantContext, appraisalId);
    if (!appraisal) {
      throw new NotFoundException('Performance appraisal not found');
    }

    if (appraisal.status !== 'draft') {
      throw new BadRequestException('Only draft appraisals can be submitted');
    }

    const updated = await this.appraisalRepository.update(tenantContext, appraisalId, {
      status: 'submitted',
      submitted_by: tenantContext.userId,
    });

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'PerformanceAppraisal',
      entity_id: appraisalId,
      old_value: appraisal,
      new_value: updated,
    });

    return updated;
  }

  async reviewAppraisal(tenantContext: TenantContext, appraisalId: string, dto: any) {
    const appraisal = await this.appraisalRepository.findById(tenantContext, appraisalId);
    if (!appraisal) {
      throw new NotFoundException('Performance appraisal not found');
    }

    if (appraisal.status !== 'submitted') {
      throw new BadRequestException('Only submitted appraisals can be reviewed');
    }

    const updated = await this.appraisalRepository.update(tenantContext, appraisalId, {
      status: 'reviewed',
      manager_rating: dto.manager_rating,
      manager_comments: dto.manager_comments,
      reviewed_by: tenantContext.userId,
    });

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'PerformanceAppraisal',
      entity_id: appraisalId,
      old_value: appraisal,
      new_value: updated,
    });

    return updated;
  }

  async finalizeAppraisal(tenantContext: TenantContext, appraisalId: string) {
    const appraisal = await this.appraisalRepository.findById(tenantContext, appraisalId);
    if (!appraisal) {
      throw new NotFoundException('Performance appraisal not found');
    }

    if (appraisal.status !== 'reviewed') {
      throw new BadRequestException('Only reviewed appraisals can be finalized');
    }

    const updated = await this.appraisalRepository.update(tenantContext, appraisalId, {
      status: 'finalized',
      finalized_by: tenantContext.userId,
    });

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'PerformanceAppraisal',
      entity_id: appraisalId,
      old_value: appraisal,
      new_value: updated,
    });

    return updated;
  }

  // Performance Goals
  async createGoal(tenantContext: TenantContext, dto: any) {
    const goal = await this.goalRepository.create(tenantContext, {
      employee_id: dto.employee_id,
      cycle_id: dto.cycle_id,
      goal_title: dto.goal_title,
      goal_description: dto.goal_description,
      goal_category: dto.goal_category,
      target_date: dto.target_date,
      owner_id: tenantContext.userId,
    });

    await this.auditService.record(tenantContext, {
      action: 'CREATE',
      entity_type: 'PerformanceGoal',
      entity_id: goal.id,
      new_value: goal,
    });

    return goal;
  }

  async updateGoal(tenantContext: TenantContext, goalId: string, dto: any) {
    const old = await this.goalRepository.findById(tenantContext, goalId);
    if (!old) {
      throw new NotFoundException('Performance goal not found');
    }

    const updated = await this.goalRepository.update(tenantContext, goalId, {
      goal_title: dto.goal_title,
      goal_description: dto.goal_description,
      status: dto.status,
      progress_percentage: dto.progress_percentage,
    });

    await this.auditService.record(tenantContext, {
      action: 'UPDATE',
      entity_type: 'PerformanceGoal',
      entity_id: goalId,
      old_value: old,
      new_value: updated,
    });

    return updated;
  }

  async getEmployeeGoals(tenantContext: TenantContext, employeeId: string) {
    return this.goalRepository.findByEmployee(tenantContext, employeeId);
  }

  // Competencies
  async createCompetency(tenantContext: TenantContext, dto: any) {
    const competency = await this.competencyRepository.create(tenantContext, {
      name: dto.name,
      code: dto.code,
      description: dto.description,
      category: dto.category,
      proficiency_levels: dto.proficiency_levels,
    });

    await this.auditService.record(tenantContext, {
      action: 'CREATE',
      entity_type: 'Competency',
      entity_id: competency.id,
      new_value: competency,
    });

    return competency;
  }

  async getCompetencies(tenantContext: TenantContext) {
    return this.competencyRepository.findAll(tenantContext);
  }

  async getCompetency(tenantContext: TenantContext, id: string) {
    const competency = await this.competencyRepository.findById(tenantContext, id);
    if (!competency) {
      throw new NotFoundException('Competency not found');
    }
    return competency;
  }
}
