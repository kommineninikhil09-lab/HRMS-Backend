const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://hrms_admin:HRMS%404AT@localhost:5432/hrms_dev"
});

async function cleanup() {
  try {
    await pool.query('DELETE FROM pgmigrations WHERE name = $1', ['1724100001000_fix_table_ownership']);
    console.log('✓ Cleaned up failed migration record');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

cleanup();
