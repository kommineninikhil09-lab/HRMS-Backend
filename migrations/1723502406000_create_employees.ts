import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('employees', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    user_id: { type: 'uuid', references: '"users"(id)' },
    employee_code: { type: 'varchar(50)', notNull: true },
    first_name: { type: 'varchar(100)', notNull: true },
    last_name: { type: 'varchar(100)', notNull: true },
    work_email: { type: 'varchar(255)' },
    personal_email: { type: 'varchar(255)' },
    phone: { type: 'varchar(20)' },
    dob: { type: 'date' },
    gender: { type: 'varchar(20)' },
    department_id: { type: 'uuid', references: '"departments"(id)' },
    team_id: { type: 'uuid', references: '"teams"(id)' },
    location_id: { type: 'uuid', references: '"locations"(id)' },
    designation_id: { type: 'uuid', references: '"designations"(id)' },
    grade_id: { type: 'uuid', references: '"grades"(id)' },
    business_unit_id: { type: 'uuid', references: '"business_units"(id)' },
    manager_id: { type: 'uuid', references: '"employees"(id)' },
    employment_type: { type: 'varchar(50)' },
    date_of_joining: { type: 'date', notNull: true },
    date_of_exit: { type: 'date' },
    status: { type: 'varchar(50)', default: 'active', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    created_by: { type: 'uuid', references: '"users"(id)' },
    updated_by: { type: 'uuid', references: '"users"(id)' },
  }, { ifNotExists: true });

  pgm.createConstraint('employees', 'uq_employees_org_code', {
    unique: ['organization_id', 'employee_code'],
  });

  pgm.createConstraint('employees', 'uq_employees_org_email', {
    unique: ['organization_id', 'work_email'],
  });

  pgm.createIndex('employees', ['organization_id']);
  pgm.createIndex('employees', ['user_id']);
  pgm.createIndex('employees', ['department_id']);
  pgm.createIndex('employees', ['location_id']);
  pgm.createIndex('employees', ['manager_id']);
  pgm.createIndex('employees', ['status']);
  pgm.createIndex('employees', ['date_of_joining']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('employees', { ifExists: true });
}

