const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hrms_admin:HRMS@4AT@localhost:5432/hrms_dev'
});

async function test() {
  console.log('Checking password hash for admin user...\n');

  // Get the hashed password from database
  const userRes = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    ['admin@dev-org.local']
  );

  if (userRes.rows.length === 0) {
    console.log('❌ User not found!');
    await pool.end();
    return;
  }

  const user = userRes.rows[0];
  console.log('✓ User found:');
  console.log(`  Email: ${user.email}`);
  console.log(`  Hash exists: ${!!user.password_hash}`);
  console.log(`  Hash length: ${user.password_hash?.length || 0}`);

  // Test password comparison
  console.log('\nTesting password comparison...');
  const testPassword = 'Admin@123456';
  const isValid = await bcrypt.compare(testPassword, user.password_hash);

  console.log(`  Password "${testPassword}" is valid: ${isValid}`);

  if (!isValid) {
    console.log('\n❌ Password hash validation FAILED');
    console.log('   This means either:');
    console.log('   1. The password was not hashed during seeding');
    console.log('   2. The hash is corrupted');
    console.log('   3. The password stored is different');
  } else {
    console.log('\n✓ Password hash validation PASSED');
  }

  await pool.end();
}

test().catch(console.error);
