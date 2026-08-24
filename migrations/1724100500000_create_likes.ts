
export async function up(pgm: any): Promise<void> {
  pgm.createTable('likes', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    user_id: { type: 'uuid', notNull: true, references: '"users"(id)' },
    likeable_type: { type: 'varchar(50)', notNull: true }, // post, praise, comment
    likeable_id: { type: 'uuid', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  }, { ifNotExists: true });

  // Composite unique constraint: one like per user per item
  pgm.createConstraint('likes', 'uq_likes_user_item', {
    unique: ['user_id', 'likeable_type', 'likeable_id'],
  });

  // Composite index for finding likes on a specific item
  pgm.createIndex('likes', ['likeable_type', 'likeable_id'], { name: 'idx_likes_likeable' });
  pgm.createIndex('likes', ['organization_id']);
  pgm.createIndex('likes', ['user_id']);
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('likes', { ifExists: true });
}

