const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hrms_admin:HRMS@4AT@localhost:5432/hrms_dev'
});

async function test() {
  const res = await pool.query(
    'SELECT id, email, organization_id FROM users WHERE email = $1',
    ['admin@dev-org.local']
  );
  console.log('User data:');
  console.log(JSON.stringify(res.rows[0], null, 2));
  await pool.end();
}

test().catch(console.error);
