
export async function up(pgm: any): Promise<void> {
  pgm.createTable('grades', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    name: { type: 'varchar(100)', notNull: true },
    rank_order: { type: 'integer', notNull: true },
    status: { type: 'varchar(50)', default: 'active', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    created_by: { type: 'uuid', references: '"users"(id)' },
    updated_by: { type: 'uuid', references: '"users"(id)' },
  }, { ifNotExists: true });

  pgm.createConstraint('grades', 'uq_grades_org_name', {
    unique: ['organization_id', 'name'],
  });

  pgm.createIndex('grades', ['organization_id']);
  pgm.createIndex('grades', ['rank_order']);
  pgm.createIndex('grades', ['status']);
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('grades', { ifExists: true });
}


