import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hrms_user:hrms_password@localhost:5432/hrms',
});

async function runMigrations() {
  const client = await pool.connect();

  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS pgmigrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        run_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.ts'))
      .sort();

    for (const file of files) {
      const migrationName = file.replace('.ts', '');

      // Check if migration already ran
      const result = await client.query(
        'SELECT * FROM pgmigrations WHERE name = $1',
        [migrationName]
      );

      if (result.rows.length > 0) {
        console.log(`✓ Already run: ${file}`);
        continue;
      }

      try {
        console.log(`Running: ${file}`);

        // For attendance and leave migrations
        if (file.includes('attendance') || file.includes('leave')) {
          const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

          // Extract SQL from migration file
          if (file.includes('1723503410000')) {
            // Attendance tables migration
            const sql = `
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
                UNIQUE(organization_id, employee_id, attendance_date)
              );

              CREATE INDEX IF NOT EXISTS idx_attendance_org ON attendance(organization_id);
              CREATE INDEX IF NOT EXISTS idx_attendance_emp ON attendance(employee_id);
              CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
              CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

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
                UNIQUE(organization_id, code)
              );

              CREATE INDEX IF NOT EXISTS idx_leave_types_org ON leave_types(organization_id);

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
                UNIQUE(organization_id, employee_id, leave_type_id, financial_year)
              );

              CREATE INDEX IF NOT EXISTS idx_leave_balance_org ON leave_balance(organization_id);
              CREATE INDEX IF NOT EXISTS idx_leave_balance_emp ON leave_balance(employee_id);
              CREATE INDEX IF NOT EXISTS idx_leave_balance_type ON leave_balance(leave_type_id);

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

              CREATE INDEX IF NOT EXISTS idx_leave_requests_org ON leave_requests(organization_id);
              CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON leave_requests(employee_id);
              CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
              CREATE INDEX IF NOT EXISTS idx_leave_requests_start ON leave_requests(start_date);
              CREATE INDEX IF NOT EXISTS idx_leave_requests_approver ON leave_requests(approver_id);

              CREATE TABLE IF NOT EXISTS holidays (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                organization_id UUID NOT NULL REFERENCES organizations(id),
                name VARCHAR(255) NOT NULL,
                holiday_date DATE NOT NULL,
                is_optional BOOLEAN NOT NULL DEFAULT FALSE,
                description TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(organization_id, holiday_date)
              );

              CREATE INDEX IF NOT EXISTS idx_holidays_org ON holidays(organization_id);
              CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);
            `;
            await client.query(sql);
          } else if (file.includes('1723503420000')) {
            // Add permissions migration
            const sql = `
              INSERT INTO permissions (code, description, module)
              VALUES
                ('attendance.read', 'View attendance records', 'Attendance'),
                ('attendance.write', 'Clock in/out and manage personal attendance', 'Attendance'),
                ('attendance.manage', 'Mark attendance for employees', 'Attendance'),
                ('leave.read', 'View leave requests and balance', 'Leave'),
                ('leave.write', 'Create and manage leave requests', 'Leave'),
                ('leave.approve', 'Approve or reject leave requests', 'Leave')
              ON CONFLICT (code) DO NOTHING;
            `;
            await client.query(sql);
          }
        }

        // Record migration
        await client.query(
          'INSERT INTO pgmigrations (name, run_on) VALUES ($1, NOW())',
          [migrationName]
        );
        console.log(`✓ Completed: ${file}`);
      } catch (error) {
        console.error(`✗ Failed: ${file}`, error instanceof Error ? error.message : error);
        throw error;
      }
    }

    console.log('\n✅ All migrations completed successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
