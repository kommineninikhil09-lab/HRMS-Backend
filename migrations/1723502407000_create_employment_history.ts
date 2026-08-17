import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('employment_history', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    employee_id: { type: 'uuid', notNull: true, references: '"employees"(id)' },
    event_type: { type: 'varchar(50)', notNull: true },
    effective_date: { type: 'date', notNull: true },
    previous_value: { type: 'jsonb' },
    new_value: { type: 'jsonb' },
    reason: { type: 'text' },
    created_by: { type: 'uuid', references: '"users"(id)' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  }, { ifNotExists: true });

  pgm.createIndex('employment_history', ['organization_id']);
  pgm.createIndex('employment_history', ['employee_id']);
  pgm.createIndex('employment_history', ['event_type']);
  pgm.createIndex('employment_history', ['effective_date']);
  pgm.createIndex('employment_history', ['created_at']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('employment_history', { ifExists: true });
}

