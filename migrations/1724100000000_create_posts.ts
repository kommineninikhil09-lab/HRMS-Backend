
export async function up(pgm: any): Promise<void> {
  pgm.createTable('posts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    user_id: { type: 'uuid', notNull: true, references: '"users"(id)' },
    content: { type: 'text', notNull: true },
    category: { type: 'varchar(50)', default: 'general', notNull: true }, // general, announcement, celebration
    status: { type: 'varchar(50)', default: 'published', notNull: true }, // published, draft, archived
    likes_count: { type: 'int', default: 0, notNull: true },
    comments_count: { type: 'int', default: 0, notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    deleted_at: { type: 'timestamptz' }, // soft delete
    created_by: { type: 'uuid', references: '"users"(id)' },
    updated_by: { type: 'uuid', references: '"users"(id)' },
  }, { ifNotExists: true });

  // Indexes for common queries
  pgm.createIndex('posts', ['organization_id']);
  pgm.createIndex('posts', ['user_id']);
  pgm.createIndex('posts', ['organization_id', 'created_at'], { name: 'idx_posts_org_created' });
  pgm.createIndex('posts', ['status']);
  pgm.createIndex('posts', ['deleted_at']);
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('posts', { ifExists: true });
}

