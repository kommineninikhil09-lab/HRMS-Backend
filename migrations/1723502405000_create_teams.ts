
export async function up(pgm: any): Promise<void> {
  pgm.createTable('teams', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    department_id: { type: 'uuid', notNull: true, references: '"departments"(id)' },
    name: { type: 'varchar(255)', notNull: true },
    code: { type: 'varchar(50)', notNull: true },
    lead_employee_id: { type: 'uuid' },
    status: { type: 'varchar(50)', default: 'active', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    created_by: { type: 'uuid', references: '"users"(id)' },
    updated_by: { type: 'uuid', references: '"users"(id)' },
  }, { ifNotExists: true });

  pgm.createConstraint('teams', 'uq_teams_org_code', {
    unique: ['organization_id', 'code'],
  });

  pgm.createIndex('teams', ['organization_id']);
  pgm.createIndex('teams', ['department_id']);
  pgm.createIndex('teams', ['status']);
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('teams', { ifExists: true });
}


