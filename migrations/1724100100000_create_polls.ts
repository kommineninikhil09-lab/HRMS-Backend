
export async function up(pgm: any): Promise<void> {
  pgm.createTable('polls', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    user_id: { type: 'uuid', notNull: true, references: '"users"(id)' },
    question: { type: 'text', notNull: true },
    description: { type: 'text' },
    notify_employees: { type: 'boolean', default: false, notNull: true },
    is_anonymous: { type: 'boolean', default: false, notNull: true },
    total_votes: { type: 'int', default: 0, notNull: true },
    status: { type: 'varchar(50)', default: 'active', notNull: true }, // active, closed, draft
    expires_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    created_by: { type: 'uuid', references: '"users"(id)' },
    updated_by: { type: 'uuid', references: '"users"(id)' },
  }, { ifNotExists: true });

  // Indexes for common queries
  pgm.createIndex('polls', ['organization_id']);
  pgm.createIndex('polls', ['user_id']);
  pgm.createIndex('polls', ['organization_id', 'created_at'], { name: 'idx_polls_org_created' });
  pgm.createIndex('polls', ['status']);
  pgm.createIndex('polls', ['expires_at']);
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('polls', { ifExists: true });
}

