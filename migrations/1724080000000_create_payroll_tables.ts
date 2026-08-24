export async function up(pgm: any): Promise<void> {
  // Salary components (e.g., Base, HRA, DA, etc.)
  pgm.createTable('salary_components', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    name: { type: 'varchar(100)', notNull: true },
    code: { type: 'varchar(20)', notNull: true },
    component_type: { type: 'varchar(50)', notNull: true }, // earnings, deduction, tax
    description: { type: 'text' },
    is_active: { type: 'boolean', default: true, notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createConstraint('salary_components', 'uq_salary_components_org_code', {
    unique: ['organization_id', 'code'],
  });
  pgm.createIndex('salary_components', ['organization_id']);

  // Salary structures (e.g., Manager, Developer, etc.)
  pgm.createTable('salary_structures', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    name: { type: 'varchar(100)', notNull: true },
    code: { type: 'varchar(20)', notNull: true },
    description: { type: 'text' },
    is_active: { type: 'boolean', default: true, notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createConstraint('salary_structures', 'uq_salary_structures_org_code', {
    unique: ['organization_id', 'code'],
  });
  pgm.createIndex('salary_structures', ['organization_id']);

  // Mapping of components to structures with amounts
  pgm.createTable('structure_components', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    structure_id: { type: 'uuid', notNull: true, references: '"salary_structures"(id)' },
    component_id: { type: 'uuid', notNull: true, references: '"salary_components"(id)' },
    amount: { type: 'numeric(14,2)', notNull: true },
    percentage: { type: 'numeric(5,2)' }, // For components calculated as percentage
    is_active: { type: 'boolean', default: true, notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createConstraint('structure_components', 'uq_structure_components', {
    unique: ['structure_id', 'component_id'],
  });
  pgm.createIndex('structure_components', ['organization_id']);
  pgm.createIndex('structure_components', ['structure_id']);

  // Pay cycles (monthly, bi-weekly, etc.)
  pgm.createTable('pay_cycles', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    name: { type: 'varchar(100)', notNull: true },
    code: { type: 'varchar(20)', notNull: true },
    frequency: { type: 'varchar(50)', notNull: true }, // monthly, bi-weekly, weekly
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date' },
    is_active: { type: 'boolean', default: true, notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createConstraint('pay_cycles', 'uq_pay_cycles_org_code', {
    unique: ['organization_id', 'code'],
  });
  pgm.createIndex('pay_cycles', ['organization_id']);

  // Salary assignments (employee to structure mapping)
  pgm.createTable('salary_assignments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    employee_id: { type: 'uuid', notNull: true, references: '"employees"(id)' },
    structure_id: { type: 'uuid', notNull: true, references: '"salary_structures"(id)' },
    effective_date: { type: 'date', notNull: true },
    end_date: { type: 'date' },
    status: { type: 'varchar(50)', notNull: true, default: 'active' }, // active, inactive, superseded
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createIndex('salary_assignments', ['organization_id']);
  pgm.createIndex('salary_assignments', ['employee_id']);
  pgm.createIndex('salary_assignments', ['structure_id']);

  // Salary slips (generated monthly)
  pgm.createTable('salary_slips', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    employee_id: { type: 'uuid', notNull: true, references: '"employees"(id)' },
    pay_cycle_id: { type: 'uuid', notNull: true, references: '"pay_cycles"(id)' },
    month: { type: 'varchar(7)', notNull: true }, // YYYY-MM
    gross_amount: { type: 'numeric(14,2)', notNull: true },
    total_deductions: { type: 'numeric(14,2)', notNull: true },
    net_amount: { type: 'numeric(14,2)', notNull: true },
    status: { type: 'varchar(50)', notNull: true, default: 'draft' }, // draft, approved, paid, cancelled
    generated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    approved_by: { type: 'uuid', references: '"users"(id)' },
    approved_at: { type: 'timestamptz' },
    paid_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createConstraint('salary_slips', 'uq_salary_slips', {
    unique: ['organization_id', 'employee_id', 'pay_cycle_id', 'month'],
  });
  pgm.createIndex('salary_slips', ['organization_id']);
  pgm.createIndex('salary_slips', ['employee_id']);
  pgm.createIndex('salary_slips', ['status']);
  pgm.createIndex('salary_slips', ['month']);

  // Salary slip line items (breakdown of components)
  pgm.createTable('slip_components', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    slip_id: { type: 'uuid', notNull: true, references: '"salary_slips"(id)' },
    component_id: { type: 'uuid', notNull: true, references: '"salary_components"(id)' },
    component_name: { type: 'varchar(100)', notNull: true },
    component_type: { type: 'varchar(50)', notNull: true }, // earnings, deduction, tax
    amount: { type: 'numeric(14,2)', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createIndex('slip_components', ['organization_id']);
  pgm.createIndex('slip_components', ['slip_id']);

  // Deductions (tax, insurance, loans, etc.)
  pgm.createTable('employee_deductions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: '"organizations"(id)' },
    employee_id: { type: 'uuid', notNull: true, references: '"employees"(id)' },
    deduction_type: { type: 'varchar(50)', notNull: true }, // tax, insurance, loan, advance
    amount: { type: 'numeric(14,2)', notNull: true },
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date' },
    reason: { type: 'text' },
    status: { type: 'varchar(50)', notNull: true, default: 'active' },
    created_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
    updated_at: { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });

  pgm.createIndex('employee_deductions', ['organization_id']);
  pgm.createIndex('employee_deductions', ['employee_id']);
  pgm.createIndex('employee_deductions', ['status']);
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('employee_deductions', { ifExists: true });
  pgm.dropTable('slip_components', { ifExists: true });
  pgm.dropTable('salary_slips', { ifExists: true });
  pgm.dropTable('salary_assignments', { ifExists: true });
  pgm.dropTable('pay_cycles', { ifExists: true });
  pgm.dropTable('structure_components', { ifExists: true });
  pgm.dropTable('salary_structures', { ifExists: true });
  pgm.dropTable('salary_components', { ifExists: true });
}
