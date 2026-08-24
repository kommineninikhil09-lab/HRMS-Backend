const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hrms_admin:HRMS@4AT@localhost:5432/hrms_dev',
});

async function testEmployeeLookup() {
  const client = await pool.connect();
  try {
    // Get the organization
    const orgResult = await client.query(`SELECT id FROM organizations LIMIT 1;`);
    const organizationId = orgResult.rows[0].id;
    console.log(`\nOrganization ID: ${organizationId}`);

    // Get all users
    const usersResult = await client.query(`
      SELECT id, email, organization_id
      FROM users
      WHERE organization_id = $1
      ORDER BY email;
    `, [organizationId]);
    console.log(`\n✓ Found ${usersResult.rows.length} users:`);
    usersResult.rows.forEach(u => console.log(`  - ${u.email} (user_id: ${u.id})`));

    // Test findByUserId for each user
    console.log(`\n✓ Testing employee lookup by user_id:`);
    for (const user of usersResult.rows) {
      const empResult = await client.query(`
        SELECT id, employee_code, first_name, work_email, user_id
        FROM employees
        WHERE user_id = $1 AND organization_id = $2;
      `, [user.id, organizationId]);

      if (empResult.rows.length > 0) {
        const emp = empResult.rows[0];
        console.log(`  ✓ ${user.email} -> Employee: ${emp.first_name} (${emp.employee_code})`);
      } else {
        console.log(`  ✗ ${user.email} -> NO EMPLOYEE FOUND`);
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testEmployeeLookup();
