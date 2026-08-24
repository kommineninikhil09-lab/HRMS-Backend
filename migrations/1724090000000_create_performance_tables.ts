export async function up(pgm: any): Promise<void> {
  // Performance cycles (review periods)
  pgm.createTable('performance_cycles', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    name: { type: 'varchar(100)', notNull: true },
    cycle_type: { type: 'varchar(50)', notNull: true }, // annual, bi-annual, quarterly, ad_hoc
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date', notNull: true },
    nomination_start_date: { type: 'date' },
    nomination_end_date: { type: 'date' },
    review_start_date: { type: 'date' },
    review_end_date: { type: 'date' },
    finalization_date: { type: 'date' },
    status: { type: 'varchar(50)', default: 'draft', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createIndex('performance_cycles', ['organization_id']);

  // Competencies framework
  pgm.createTable('competencies', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    name: { type: 'varchar(100)', notNull: true },
    code: { type: 'varchar(20)', notNull: true },
    description: { type: 'text' },
    category: { type: 'varchar(50)', notNull: true }, // technical, behavioral, leadership
    proficiency_levels: { type: 'int', default: 5, notNull: true },
    is_active: { type: 'boolean', default: true, notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createConstraint('competencies', 'uq_competencies_org_code', {
    unique: ['organization_id', 'code'],
  });
  pgm.createIndex('competencies', ['organization_id']);
  pgm.createIndex('competencies', ['category']);

  // Competency levels
  pgm.createTable('competency_levels', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    competency_id: { type: 'uuid', notNull: true, references: '"competencies"(id)' },
    level: { type: 'int', notNull: true },
    name: { type: 'varchar(50)', notNull: true },
    description: { type: 'text' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createIndex('competency_levels', ['organization_id']);
  pgm.createIndex('competency_levels', ['competency_id']);

  // Appraisal templates
  pgm.createTable('appraisal_templates', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    name: { type: 'varchar(200)', notNull: true },
    description: { type: 'text' },
    template_type: { type: 'varchar(50)', notNull: true }, // manager, peer, self, hr
    rating_scale: { type: 'varchar(50)', default: '1-5', notNull: true },
    total_sections: { type: 'int' },
    is_active: { type: 'boolean', default: true, notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createIndex('appraisal_templates', ['organization_id']);

  // Appraisal sections
  pgm.createTable('appraisal_sections', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    template_id: { type: 'uuid', notNull: true, references: '"appraisal_templates"(id)' },
    name: { type: 'varchar(100)', notNull: true },
    description: { type: 'text' },
    section_order: { type: 'int', notNull: true },
    weight: { type: 'numeric(5,2)', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createIndex('appraisal_sections', ['organization_id']);
  pgm.createIndex('appraisal_sections', ['template_id']);

  // Appraisal questions
  pgm.createTable('appraisal_questions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    section_id: { type: 'uuid', notNull: true, references: '"appraisal_sections"(id)' },
    competency_id: { type: 'uuid', references: '"competencies"(id)' },
    question_text: { type: 'text', notNull: true },
    question_order: { type: 'int', notNull: true },
    rating_scale: { type: 'varchar(50)', default: '1-5', notNull: true },
    is_required: { type: 'boolean', default: true, notNull: true },
    help_text: { type: 'text' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createIndex('appraisal_questions', ['organization_id']);
  pgm.createIndex('appraisal_questions', ['section_id']);
  pgm.createIndex('appraisal_questions', ['competency_id']);

  // Performance appraisals (main entity)
  pgm.createTable('performance_appraisals', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    cycle_id: { type: 'uuid', notNull: true, references: '"performance_cycles"(id)' },
    employee_id: { type: 'uuid', notNull: true, references: '"employees"(id)' },
    template_id: { type: 'uuid', notNull: true, references: '"appraisal_templates"(id)' },
    manager_id: { type: 'uuid', references: '"employees"(id)' },
    status: { type: 'varchar(50)', default: 'draft', notNull: true },
    appraisal_type: { type: 'varchar(50)', notNull: true }, // self, manager, peer, hr

    overall_rating: { type: 'numeric(5,2)' },
    self_rating: { type: 'numeric(5,2)' },
    manager_rating: { type: 'numeric(5,2)' },
    peer_rating: { type: 'numeric(5,2)' },
    hr_rating: { type: 'numeric(5,2)' },

    rating_count: { type: 'int', default: 0 },
    reviewer_count: { type: 'int' },
    average_rating: { type: 'numeric(5,2)' },

    self_assessment_comments: { type: 'text' },
    manager_comments: { type: 'text' },
    development_areas: { type: 'text' },
    strengths: { type: 'text' },
    goals_next_period: { type: 'text' },

    created_by: { type: 'uuid', references: '"users"(id)' },
    submitted_by: { type: 'uuid', references: '"users"(id)' },
    reviewed_by: { type: 'uuid', references: '"users"(id)' },
    finalized_by: { type: 'uuid', references: '"users"(id)' },

    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    submitted_at: { type: 'timestamptz' },
    reviewed_at: { type: 'timestamptz' },
    finalized_at: { type: 'timestamptz' },
  });

  pgm.createConstraint('performance_appraisals', 'uq_performance_appraisals', {
    unique: ['organization_id', 'cycle_id', 'employee_id', 'appraisal_type'],
  });
  pgm.createIndex('performance_appraisals', ['organization_id']);
  pgm.createIndex('performance_appraisals', ['cycle_id']);
  pgm.createIndex('performance_appraisals', ['employee_id']);
  pgm.createIndex('performance_appraisals', ['status']);

  // Appraisal ratings
  pgm.createTable('appraisal_ratings', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    appraisal_id: { type: 'uuid', notNull: true, references: '"performance_appraisals"(id)' },
    question_id: { type: 'uuid', notNull: true, references: '"appraisal_questions"(id)' },
    reviewer_id: { type: 'uuid', notNull: true, references: '"users"(id)' },
    reviewer_type: { type: 'varchar(50)', notNull: true },
    rating_value: { type: 'int', notNull: true },
    comments: { type: 'text' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createConstraint('appraisal_ratings', 'uq_appraisal_ratings', {
    unique: ['organization_id', 'appraisal_id', 'question_id', 'reviewer_id'],
  });
  pgm.createIndex('appraisal_ratings', ['organization_id']);
  pgm.createIndex('appraisal_ratings', ['appraisal_id']);
  pgm.createIndex('appraisal_ratings', ['reviewer_id']);

  // Appraisal feedbacks (360 feedback)
  pgm.createTable('appraisal_feedbacks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    appraisal_id: { type: 'uuid', notNull: true, references: '"performance_appraisals"(id)' },
    feedback_provider_id: { type: 'uuid', references: '"users"(id)' },
    feedback_provider_type: { type: 'varchar(50)', notNull: true },
    feedback_text: { type: 'text' },
    is_anonymous: { type: 'boolean', default: false },
    rating: { type: 'int' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createIndex('appraisal_feedbacks', ['organization_id']);
  pgm.createIndex('appraisal_feedbacks', ['appraisal_id']);

  // Performance goals
  pgm.createTable('performance_goals', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    employee_id: { type: 'uuid', notNull: true, references: '"employees"(id)' },
    cycle_id: { type: 'uuid', references: '"performance_cycles"(id)' },
    appraisal_id: { type: 'uuid', references: '"performance_appraisals"(id)' },
    goal_title: { type: 'varchar(200)', notNull: true },
    goal_description: { type: 'text' },
    goal_category: { type: 'varchar(50)', notNull: true },
    target_date: { type: 'date' },
    status: { type: 'varchar(50)', default: 'open', notNull: true },
    progress_percentage: { type: 'numeric(5,2)', default: 0 },
    completion_date: { type: 'date' },
    owner_id: { type: 'uuid', references: '"users"(id)' },
    reviewer_id: { type: 'uuid', references: '"users"(id)' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createIndex('performance_goals', ['organization_id']);
  pgm.createIndex('performance_goals', ['employee_id']);
  pgm.createIndex('performance_goals', ['cycle_id']);

  // Performance history (audit trail, append-only)
  pgm.createTable('performance_history', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    appraisal_id: { type: 'uuid', notNull: true, references: '"performance_appraisals"(id)' },
    event_type: { type: 'varchar(50)', notNull: true },
    effective_date: { type: 'timestamptz', notNull: true },
    actor_user_id: { type: 'uuid', references: '"users"(id)' },
    previous_value: { type: 'jsonb' },
    new_value: { type: 'jsonb' },
    change_reason: { type: 'text' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createIndex('performance_history', ['organization_id']);
  pgm.createIndex('performance_history', ['appraisal_id']);
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('performance_history', { ifExists: true });
  pgm.dropTable('performance_goals', { ifExists: true });
  pgm.dropTable('appraisal_feedbacks', { ifExists: true });
  pgm.dropTable('appraisal_ratings', { ifExists: true });
  pgm.dropTable('performance_appraisals', { ifExists: true });
  pgm.dropTable('appraisal_questions', { ifExists: true });
  pgm.dropTable('appraisal_sections', { ifExists: true });
  pgm.dropTable('appraisal_templates', { ifExists: true });
  pgm.dropTable('competency_levels', { ifExists: true });
  pgm.dropTable('competencies', { ifExists: true });
  pgm.dropTable('performance_cycles', { ifExists: true });
}
