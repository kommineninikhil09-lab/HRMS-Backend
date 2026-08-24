const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://hrms_admin:HRMS%404AT@localhost:5432/hrms_dev"
});

const migrationsToMark = [
  '1723502400000_create_business_units',
  '1723502401000_create_locations',
  '1723502402000_create_departments',
  '1723502403000_create_grades',
  '1723502404000_create_designations',
  '1723502405000_create_teams',
  '1723502406000_create_employees',
  '1723502407000_create_employment_history',
  '1723502408000_create_employee_documents',
  '1723502409000_create_employee_profiles',
  '1723503410000_create_attendance_tables',
  '1723503420000_add_attendance_leave_permissions',
  '1724079600000_link-employees-to-users',
  '1724079700000_add_marked_by_to_attendance',
  '1724080000000_create_payroll_tables',
  '1724080100000_add_payroll_permissions',
  '1724090000000_create_performance_tables',
  '1724090100000_add_performance_permissions',
];

async function markMigrations() {
  try {
    for (const migration of migrationsToMark) {
      await pool.query(
        'INSERT INTO pgmigrations (name, run_on) VALUES ($1, NOW())',
        [migration]
      );
      console.log(`✓ Marked: ${migration}`);
    }
    console.log('\n✓ All migrations marked as complete');
  } catch (err) {
    console.error('Error marking migrations:', err.message);
  } finally {
    await pool.end();
  }
}

markMigrations();
