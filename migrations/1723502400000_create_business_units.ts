import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('business_units', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    name: { type: 'varchar(255)', notNull: true },
    code: { type: 'varchar(50)', notNull: true },
    parent_business_unit_id: { type: 'uuid', references: '"business_units"(id)' },
    status: { type: 'varchar(50)', default: 'active', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    created_by: { type: 'uuid', references: '"users"(id)' },
    updated_by: { type: 'uuid', references: '"users"(id)' },
  }, { ifNotExists: true });

  pgm.createConstraint('business_units', 'uq_business_units_org_code', {
    unique: ['organization_id', 'code'],
  });

  pgm.createIndex('business_units', ['organization_id']);
  pgm.createIndex('business_units', ['parent_business_unit_id']);
  pgm.createIndex('business_units', ['status']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('business_units', { ifExists: true });
}

