
export async function up(pgm: any): Promise<void> {
  pgm.createTable('departments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    business_unit_id: { type: 'uuid', notNull: true, references: '"business_units"(id)' },
    name: { type: 'varchar(255)', notNull: true },
    code: { type: 'varchar(50)', notNull: true },
    parent_department_id: { type: 'uuid', references: '"departments"(id)' },
    head_employee_id: { type: 'uuid' },
    status: { type: 'varchar(50)', default: 'active', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    created_by: { type: 'uuid', references: '"users"(id)' },
    updated_by: { type: 'uuid', references: '"users"(id)' },
  }, { ifNotExists: true });

  pgm.createConstraint('departments', 'uq_departments_org_code', {
    unique: ['organization_id', 'code'],
  });

  pgm.createIndex('departments', ['organization_id']);
  pgm.createIndex('departments', ['business_unit_id']);
  pgm.createIndex('departments', ['parent_department_id']);
  pgm.createIndex('departments', ['status']);
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('departments', { ifExists: true });
}


