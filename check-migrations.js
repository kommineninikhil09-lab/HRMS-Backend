const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgresql://hrms_admin:HRMS%404AT@localhost:5432/hrms_dev"
});

async function checkMigrations() {
  try {
    const result = await pool.query("SELECT * FROM pgmigrations ORDER BY run_on");
    console.log("Completed migrations:");
    result.rows.forEach(row => console.log(`  ${row.name}`));
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

checkMigrations();
