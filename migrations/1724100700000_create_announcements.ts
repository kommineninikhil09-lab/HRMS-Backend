
export async function up(pgm: any): Promise<void> {
  pgm.createTable('announcements', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    created_by_user_id: { type: 'uuid', notNull: true, references: '"users"(id)' },
    title: { type: 'text', notNull: true },
    content: { type: 'text', notNull: true },
    priority: { type: 'varchar(50)', default: 'medium', notNull: true }, // low, medium, high, urgent
    status: { type: 'varchar(50)', default: 'published', notNull: true }, // published, scheduled, draft, archived
    published_at: { type: 'timestamptz' },
    expires_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  }, { ifNotExists: true });

  // Indexes for common queries
  pgm.createIndex('announcements', ['organization_id']);
  pgm.createIndex('announcements', ['created_by_user_id']);
  pgm.createIndex('announcements', ['status']);
  pgm.createIndex('announcements', ['priority']);
  pgm.createIndex('announcements', ['organization_id', 'published_at'], { name: 'idx_announcements_org_published' });
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('announcements', { ifExists: true });
}

