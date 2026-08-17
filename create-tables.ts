import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hrms_user:hrms_password@localhost:5432/hrms',
});

async function createTables() {
  const client = await pool.connect();

  try {
    console.log('Creating attendance tables...');

    // Attendance table
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        employee_id UUID NOT NULL REFERENCES employees(id),
        attendance_date DATE NOT NULL,
        clock_in_time TIMESTAMPTZ,
        clock_out_time TIMESTAMPTZ,
        status VARCHAR(50) NOT NULL DEFAULT 'absent',
        notes TEXT,
        marked_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_attendance_employee_date UNIQUE(organization_id, employee_id, attendance_date)
      );
    `);
    console.log('✓ attendance table created');

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_org ON attendance(organization_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_emp ON attendance(employee_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);`);
    console.log('✓ attendance indexes created');

    // Leave types table
    await client.query(`
      CREATE TABLE IF NOT EXISTS leave_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) NOT NULL,
        annual_allocation INTEGER NOT NULL DEFAULT 0,
        carry_forward_limit INTEGER DEFAULT 0,
        requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
        is_paid BOOLEAN NOT NULL DEFAULT TRUE,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_leave_types_org_code UNIQUE(organization_id, code)
      );
    `);
    console.log('✓ leave_types table created');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_leave_types_org ON leave_types(organization_id);`);
    console.log('✓ leave_types indexes created');

    // Leave balance table
    await client.query(`
      CREATE TABLE IF NOT EXISTS leave_balance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        employee_id UUID NOT NULL REFERENCES employees(id),
        leave_type_id UUID NOT NULL REFERENCES leave_types(id),
        financial_year VARCHAR(9) NOT NULL,
        opening_balance NUMERIC(8,2) NOT NULL DEFAULT 0,
        allocated NUMERIC(8,2) NOT NULL DEFAULT 0,
        used NUMERIC(8,2) NOT NULL DEFAULT 0,
        pending NUMERIC(8,2) NOT NULL DEFAULT 0,
        carry_forward NUMERIC(8,2) NOT NULL DEFAULT 0,
        lapsed NUMERIC(8,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_leave_balance UNIQUE(organization_id, employee_id, leave_type_id, financial_year)
      );
    `);
    console.log('✓ leave_balance table created');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_leave_balance_org ON leave_balance(organization_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leave_balance_emp ON leave_balance(employee_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leave_balance_type ON leave_balance(leave_type_id);`);
    console.log('✓ leave_balance indexes created');

    // Leave requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        employee_id UUID NOT NULL REFERENCES employees(id),
        leave_type_id UUID NOT NULL REFERENCES leave_types(id),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        duration_days NUMERIC(8,2) NOT NULL,
        reason TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        approver_id UUID REFERENCES users(id),
        approved_at TIMESTAMPTZ,
        rejection_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✓ leave_requests table created');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_org ON leave_requests(organization_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON leave_requests(employee_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_start ON leave_requests(start_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_approver ON leave_requests(approver_id);`);
    console.log('✓ leave_requests indexes created');

    // Holidays table
    await client.query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        name VARCHAR(255) NOT NULL,
        holiday_date DATE NOT NULL,
        is_optional BOOLEAN NOT NULL DEFAULT FALSE,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_holidays UNIQUE(organization_id, holiday_date)
      );
    `);
    console.log('✓ holidays table created');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_holidays_org ON holidays(organization_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);`);
    console.log('✓ holidays indexes created');

    console.log('\n✅ All tables created successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

createTables().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
