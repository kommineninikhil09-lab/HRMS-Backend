import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('employee_profiles', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    employee_id: { type: 'uuid', notNull: true, references: '"employees"(id)' },
    address: { type: 'text' },
    city: { type: 'varchar(100)' },
    state: { type: 'varchar(100)' },
    country: { type: 'varchar(100)' },
    postal_code: { type: 'varchar(20)' },
    emergency_contact_name: { type: 'varchar(255)' },
    emergency_contact_phone: { type: 'varchar(20)' },
    emergency_contact_relationship: { type: 'varchar(50)' },
    marital_status: { type: 'varchar(50)' },
    blood_group: { type: 'varchar(5)' },
    bank_account_number: { type: 'varchar(100)' },
    bank_name: { type: 'varchar(255)' },
    ifsc_code: { type: 'varchar(20)' },
    base_salary: { type: 'numeric(14,2)' },
    currency: { type: 'varchar(3)', default: 'USD' },
    pay_frequency: { type: 'varchar(50)' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    created_by: { type: 'uuid', references: '"users"(id)' },
    updated_by: { type: 'uuid', references: '"users"(id)' },
  }, { ifNotExists: true });

  pgm.createConstraint('employee_profiles', 'uq_employee_profiles_employee_id', {
    unique: ['employee_id'],
  });

  pgm.createIndex('employee_profiles', ['organization_id']);
  pgm.createIndex('employee_profiles', ['employee_id']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('employee_profiles', { ifExists: true });
}

