import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Attendance table - daily records
  pgm.createTable('attendance', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    employee_id: { type: 'uuid', notNull: true, references: '"employees"(id)' },
    attendance_date: { type: 'date', notNull: true },
    clock_in_time: { type: 'timestamptz' },
    clock_out_time: { type: 'timestamptz' },
    status: { type: 'varchar(50)', notNull: true, default: 'absent' },
    notes: { type: 'text' },
    marked_by: { type: 'uuid', references: '"users"(id)' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  }, { ifNotExists: true });

  pgm.createConstraint('attendance', 'uq_attendance_employee_date', {
    unique: ['organization_id', 'employee_id', 'attendance_date'],
  });

  pgm.createIndex('attendance', ['organization_id']);
  pgm.createIndex('attendance', ['employee_id']);
  pgm.createIndex('attendance', ['attendance_date']);
  pgm.createIndex('attendance', ['status']);

  // Leave types table
  pgm.createTable('leave_types', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    name: { type: 'varchar(100)', notNull: true },
    code: { type: 'varchar(20)', notNull: true },
    annual_allocation: { type: 'integer', notNull: true, default: 0 },
    carry_forward_limit: { type: 'integer', default: 0 },
    requires_approval: { type: 'boolean', default: true, notNull: true },
    is_paid: { type: 'boolean', default: true, notNull: true },
    description: { type: 'text' },
    status: { type: 'varchar(50)', default: 'active', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  }, { ifNotExists: true });

  pgm.createConstraint('leave_types', 'uq_leave_types_org_code', {
    unique: ['organization_id', 'code'],
  });

  pgm.createIndex('leave_types', ['organization_id']);

  // Leave balance table
  pgm.createTable('leave_balance', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    employee_id: { type: 'uuid', notNull: true, references: '"employees"(id)' },
    leave_type_id: { type: 'uuid', notNull: true, references: '"leave_types"(id)' },
    financial_year: { type: 'varchar(9)', notNull: true },
    opening_balance: { type: 'numeric(8,2)', default: 0, notNull: true },
    allocated: { type: 'numeric(8,2)', default: 0, notNull: true },
    used: { type: 'numeric(8,2)', default: 0, notNull: true },
    pending: { type: 'numeric(8,2)', default: 0, notNull: true },
    carry_forward: { type: 'numeric(8,2)', default: 0, notNull: true },
    lapsed: { type: 'numeric(8,2)', default: 0, notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  }, { ifNotExists: true });

  pgm.createConstraint('leave_balance', 'uq_leave_balance', {
    unique: ['organization_id', 'employee_id', 'leave_type_id', 'financial_year'],
  });

  pgm.createIndex('leave_balance', ['organization_id']);
  pgm.createIndex('leave_balance', ['employee_id']);
  pgm.createIndex('leave_balance', ['leave_type_id']);

  // Leave requests table
  pgm.createTable('leave_requests', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    employee_id: { type: 'uuid', notNull: true, references: '"employees"(id)' },
    leave_type_id: { type: 'uuid', notNull: true, references: '"leave_types"(id)' },
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date', notNull: true },
    duration_days: { type: 'numeric(8,2)', notNull: true },
    reason: { type: 'text' },
    status: { type: 'varchar(50)', default: 'draft', notNull: true },
    approver_id: { type: 'uuid', references: '"users"(id)' },
    approved_at: { type: 'timestamptz' },
    rejection_reason: { type: 'text' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  }, { ifNotExists: true });

  pgm.createIndex('leave_requests', ['organization_id']);
  pgm.createIndex('leave_requests', ['employee_id']);
  pgm.createIndex('leave_requests', ['status']);
  pgm.createIndex('leave_requests', ['start_date']);
  pgm.createIndex('leave_requests', ['approver_id']);

  // Holiday calendar table
  pgm.createTable('holidays', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    name: { type: 'varchar(255)', notNull: true },
    holiday_date: { type: 'date', notNull: true },
    is_optional: { type: 'boolean', default: false, notNull: true },
    description: { type: 'text' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  }, { ifNotExists: true });

  pgm.createConstraint('holidays', 'uq_holidays', {
    unique: ['organization_id', 'holiday_date'],
  });

  pgm.createIndex('holidays', ['organization_id']);
  pgm.createIndex('holidays', ['holiday_date']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('holidays', { ifExists: true });
  pgm.dropTable('leave_requests', { ifExists: true });
  pgm.dropTable('leave_balance', { ifExists: true });
  pgm.dropTable('leave_types', { ifExists: true });
  pgm.dropTable('attendance', { ifExists: true });
}
