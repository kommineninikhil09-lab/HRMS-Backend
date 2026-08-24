
export async function up(pgm: any): Promise<void> {
  pgm.createTable('comments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    user_id: { type: 'uuid', notNull: true, references: '"users"(id)' },
    commentable_type: { type: 'varchar(50)', notNull: true }, // post, praise
    commentable_id: { type: 'uuid', notNull: true },
    content: { type: 'text', notNull: true },
    status: { type: 'varchar(50)', default: 'published', notNull: true }, // published, pending, archived
    likes_count: { type: 'int', default: 0, notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    deleted_at: { type: 'timestamptz' }, // soft delete
    created_by: { type: 'uuid', references: '"users"(id)' },
    updated_by: { type: 'uuid', references: '"users"(id)' },
  }, { ifNotExists: true });

  // Composite index for finding comments on a specific item
  pgm.createIndex('comments', ['commentable_type', 'commentable_id'], { name: 'idx_comments_commentable' });
  pgm.createIndex('comments', ['organization_id']);
  pgm.createIndex('comments', ['user_id']);
  pgm.createIndex('comments', ['status']);
  pgm.createIndex('comments', ['deleted_at']);
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('comments', { ifExists: true });
}

