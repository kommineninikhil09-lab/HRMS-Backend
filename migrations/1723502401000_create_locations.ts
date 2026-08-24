
export async function up(pgm: any): Promise<void> {
  pgm.createTable('locations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    name: { type: 'varchar(255)', notNull: true },
    code: { type: 'varchar(50)', notNull: true },
    address: { type: 'text' },
    city: { type: 'varchar(100)' },
    state: { type: 'varchar(100)' },
    country: { type: 'varchar(100)' },
    postal_code: { type: 'varchar(20)' },
    timezone: { type: 'varchar(100)', default: 'UTC', notNull: true },
    status: { type: 'varchar(50)', default: 'active', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    created_by: { type: 'uuid', references: '"users"(id)' },
    updated_by: { type: 'uuid', references: '"users"(id)' },
  }, { ifNotExists: true });

  pgm.createConstraint('locations', 'uq_locations_org_code', {
    unique: ['organization_id', 'code'],
  });

  pgm.createIndex('locations', ['organization_id']);
  pgm.createIndex('locations', ['status']);
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('locations', { ifExists: true });
}


