
export async function up(pgm: any): Promise<void> {
  pgm.createTable('praise', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    from_user_id: { type: 'uuid', notNull: true, references: '"users"(id)' },
    to_employee_id: { type: 'uuid', notNull: true, references: '"employees"(id)' },
    badge_type: { type: 'varchar(50)', notNull: true }, // top_performer, leadership_impact, customer_hero, above_beyond, team_player, rockstar_rookie, legacy_builder, all_day_everyday
    description: { type: 'text', notNull: true },
    project_id: { type: 'uuid' }, // optional reference to projects (FK can be added when projects table exists)
    visibility: { type: 'varchar(50)', default: 'public', notNull: true }, // public, team, private
    likes_count: { type: 'int', default: 0, notNull: true },
    comments_count: { type: 'int', default: 0, notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    created_by: { type: 'uuid', references: '"users"(id)' },
    updated_by: { type: 'uuid', references: '"users"(id)' },
  }, { ifNotExists: true });

  // Indexes for common queries
  pgm.createIndex('praise', ['organization_id']);
  pgm.createIndex('praise', ['from_user_id']);
  pgm.createIndex('praise', ['to_employee_id']);
  pgm.createIndex('praise', ['organization_id', 'created_at'], { name: 'idx_praise_org_created' });
  pgm.createIndex('praise', ['badge_type']);
  pgm.createIndex('praise', ['visibility']);
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('praise', { ifExists: true });
}

