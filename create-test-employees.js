const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hrms_user:hrms_password@localhost:5432/hrms',
});

async function createTestEmployees() {
  const client = await pool.connect();
  try {
    console.log('Creating test employees...');

    // 1. Get organization ID
    const orgResult = await client.query(
      "SELECT id FROM organizations WHERE slug = 'dev-org'"
    );
    const organizationId = orgResult.rows[0].id;
    console.log('Organization ID:', organizationId);

    // 2. Get test user IDs
    const usersResult = await client.query(
      `SELECT id, email FROM users WHERE organization_id = $1 ORDER BY created_at`,
      [organizationId]
    );
    console.log('Found users:', usersResult.rows.map(r => r.email));

    // 3. Create employees for each user if they don't exist
    for (const user of usersResult.rows) {
      const existingEmployee = await client.query(
        'SELECT id FROM employees WHERE user_id = $1',
        [user.id]
      );

      if (existingEmployee.rows.length === 0) {
        const employeeCode = `EMP-${user.email.split('@')[0].toUpperCase()}`;
        const result = await client.query(
          `INSERT INTO employees (
            organization_id, user_id, employee_code, first_name, last_name,
            work_email, status, date_of_joining
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id`,
          [
            organizationId,
            user.id,
            employeeCode,
            user.email.split('@')[0],
            'User',
            user.email,
            'active',
            new Date().toISOString().split('T')[0]
          ]
        );
        console.log(`✅ Created employee for ${user.email}: ${result.rows[0].id}`);
      } else {
        console.log(`⚠️ Employee already exists for ${user.email}`);
      }
    }

    console.log('✅ Test employees created successfully!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createTestEmployees();
