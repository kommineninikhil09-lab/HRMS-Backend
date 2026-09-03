const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hrms_admin:HRMS@4AT@localhost:5432/hrms_dev'
});

async function test() {
  const userId = '6ad933d7-8187-4df1-8fa3-12f86e8a0629';

  console.log('Testing role query...\n');

  // Test 1: Simple query
  console.log('1️⃣  Simple join query:');
  const res1 = await pool.query(
    `SELECT r.id, r.name
     FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = $1`,
    [userId]
  );
  console.log(`   Result: ${res1.rowCount} rows`);
  console.log(JSON.stringify(res1.rows, null, 2));

  // Test 2: With organization_id check
  console.log('\n2️⃣  With organization_id check:');
  const organizationId = '5024d032-e638-47d7-8ba0-88ae9367465c';
  const res2 = await pool.query(
    `SELECT r.id, r.name
     FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.organization_id = $1
       AND ur.user_id = $2
       AND r.organization_id = $1`,
    [organizationId, userId]
  );
  console.log(`   Result: ${res2.rowCount} rows`);
  console.log(JSON.stringify(res2.rows, null, 2));

  await pool.end();
}

test().catch(console.error);
