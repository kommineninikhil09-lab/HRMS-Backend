import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('employee_documents', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    employee_id: { type: 'uuid', notNull: true, references: '"employees"(id)' },
    document_type: { type: 'varchar(50)', notNull: true },
    file_name: { type: 'varchar(255)', notNull: true },
    storage_key: { type: 'varchar(255)', notNull: true },
    storage_provider: { type: 'varchar(50)', default: 'local', notNull: true },
    content_type: { type: 'varchar(100)' },
    size_bytes: { type: 'bigint' },
    status: { type: 'varchar(50)', default: 'active', notNull: true },
    uploaded_by: { type: 'uuid', references: '"users"(id)' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  }, { ifNotExists: true });

  pgm.createIndex('employee_documents', ['organization_id']);
  pgm.createIndex('employee_documents', ['employee_id']);
  pgm.createIndex('employee_documents', ['document_type']);
  pgm.createIndex('employee_documents', ['status']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('employee_documents', { ifExists: true });
}

