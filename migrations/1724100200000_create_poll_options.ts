
export async function up(pgm: any): Promise<void> {
  pgm.createTable('poll_options', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    poll_id: { type: 'uuid', notNull: true, references: '"polls"(id)' },
    option_text: { type: 'text', notNull: true },
    vote_count: { type: 'int', default: 0, notNull: true },
    order: { type: 'int', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  }, { ifNotExists: true });

  // Composite unique constraint: one poll + order combo
  pgm.createConstraint('poll_options', 'uq_poll_options_poll_order', {
    unique: ['poll_id', 'order'],
  });

  // Indexes
  pgm.createIndex('poll_options', ['poll_id']);
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('poll_options', { ifExists: true });
}

