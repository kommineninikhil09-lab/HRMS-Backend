export async function up(pgm: any): Promise<void> {
  pgm.createTable('notifications', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    user_id: { type: 'uuid', notNull: true, references: '"users"(id)' },
    type: { type: 'varchar(100)', notNull: true },
    title: { type: 'varchar(255)', notNull: true },
    body: { type: 'text' },
    read_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  }, { ifNotExists: true });

  pgm.createIndex('notifications', ['user_id', 'read_at']);
  pgm.createIndex('notifications', ['organization_id']);

  pgm.createTable('notification_preferences', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    user_id: { type: 'uuid', notNull: true, references: '"users"(id)' },
    notification_type: { type: 'varchar(100)', notNull: true },
    enabled: { type: 'boolean', notNull: true, default: true },
  }, { ifNotExists: true });

  pgm.createConstraint('notification_preferences', 'uq_notification_preferences_user_type', {
    unique: ['user_id', 'notification_type'],
  });

  pgm.createIndex('notification_preferences', ['organization_id']);
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('notification_preferences', { ifExists: true });
  pgm.dropTable('notifications', { ifExists: true });
}
