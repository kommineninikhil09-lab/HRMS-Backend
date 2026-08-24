
export async function up(pgm: any): Promise<void> {
  pgm.createTable('poll_votes', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    poll_id: { type: 'uuid', notNull: true, references: '"polls"(id)' },
    poll_option_id: { type: 'uuid', notNull: true, references: '"poll_options"(id)' },
    user_id: { type: 'uuid', notNull: true, references: '"users"(id)' },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    voted_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    ip_address: { type: 'inet' },
  }, { ifNotExists: true });

  // Composite unique constraint: one vote per user per poll
  pgm.createConstraint('poll_votes', 'uq_poll_votes_poll_user', {
    unique: ['poll_id', 'user_id'],
  });

  // Indexes
  pgm.createIndex('poll_votes', ['poll_id']);
  pgm.createIndex('poll_votes', ['user_id']);
  pgm.createIndex('poll_votes', ['organization_id']);
  pgm.createIndex('poll_votes', ['poll_option_id']);
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('poll_votes', { ifExists: true });
}

