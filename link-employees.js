const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hrms_admin:HRMS@4AT@localhost:5432/hrms_dev',
});

async function linkEmployees() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      UPDATE employees e
      SET user_id = u.id
      FROM users u
      WHERE e.organization_id = u.organization_id
      AND LOWER(e.work_email) = LOWER(u.email)
      AND e.user_id IS NULL;
    `);
    console.log(`✓ Updated ${result.rowCount} employee records with user_id`);

    // Verify the updates
    const verify = await client.query(`
      SELECT e.id, e.first_name, e.work_email, e.user_id, u.email
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.organization_id = (SELECT id FROM organizations LIMIT 1)
      ORDER BY e.first_name;
    `);

    console.log('\n✓ Employee-User Linkage:');
    verify.rows.forEach(row => {
      console.log(`  ${row.first_name} (${row.work_email}) -> user_id: ${row.user_id ? '✓' : '✗'}`);
    });
  } catch (err) {
    console.error('Error linking employees:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

linkEmployees();
