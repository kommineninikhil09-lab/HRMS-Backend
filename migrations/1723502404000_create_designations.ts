import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('designations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    grade_id: { type: 'uuid', notNull: true, references: '"grades"(id)' },
    title: { type: 'varchar(255)', notNull: true },
    code: { type: 'varchar(50)', notNull: true },
    status: { type: 'varchar(50)', default: 'active', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    created_by: { type: 'uuid', references: '"users"(id)' },
    updated_by: { type: 'uuid', references: '"users"(id)' },
  }, { ifNotExists: true });

  pgm.createConstraint('designations', 'uq_designations_org_code', {
    unique: ['organization_id', 'code'],
  });

  pgm.createIndex('designations', ['organization_id']);
  pgm.createIndex('designations', ['grade_id']);
  pgm.createIndex('designations', ['status']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('designations', { ifExists: true });
}

