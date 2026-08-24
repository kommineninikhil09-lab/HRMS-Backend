const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hrms_admin:HRMS@4AT@localhost:5432/hrms_dev'
});

async function simulateFullLogin() {
  console.log('Simulating full login flow...\n');

  const email = 'admin@dev-org.local';
  const password = 'Admin@123456';

  // Step 1: Find user by email (simulating getUserByEmail)
  console.log('Step 1: Finding user by email...');
  const userRes = await pool.query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );

  if (userRes.rows.length === 0) {
    console.log('❌ User not found');
    await pool.end();
    return;
  }

  const user = userRes.rows[0];
  console.log(`✓ User found: ${user.email}`);
  console.log(`  Has password_hash: ${!!user.password_hash}`);

  // Step 2: Validate password (simulating validatePassword)
  console.log('\nStep 2: Validating password...');
  if (!user.password_hash) {
    console.log('❌ No password_hash found on user');
    await pool.end();
    return;
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  console.log(`✓ Password validation result: ${isValid}`);

  if (!isValid) {
    console.log('❌ Password is invalid!');
    console.log('\nDebugging info:');
    console.log(`  Provided password: "${password}"`);
    console.log(`  Hash length: ${user.password_hash.length}`);
    console.log(`  Hash sample: ${user.password_hash.substring(0, 20)}...`);
    await pool.end();
    return;
  }

  // Step 3: Simulate returning user (validateCredentials returns identity)
  console.log('\nStep 3: Would return user identity...');
  const identity = {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  };
  console.log(`✓ Identity: ${JSON.stringify(identity)}`);

  // Step 4: Get organization and create JWT
  console.log('\nStep 4: User would receive JWT...');
  console.log(`✓ User organization_id: ${user.organization_id}`);
  console.log(`✓ User id: ${user.id}`);

  console.log('\n✅ LOGIN FLOW SUCCESSFUL - All steps pass');

  await pool.end();
}

simulateFullLogin().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
