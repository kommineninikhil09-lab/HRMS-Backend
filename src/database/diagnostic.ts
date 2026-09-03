import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hrms_admin:HRMS@4AT@localhost:5432/hrms_dev',
});

export async function runDiagnostics() {
  const client = await pool.connect();
  try {
    console.log('\n📊 DATABASE DIAGNOSTICS\n');

    // Check if tables exist
    console.log('1️⃣  Checking table existence...');
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'roles', 'user_roles', 'permissions', 'role_permissions')
      ORDER BY table_name
    `;
    const tablesResult = await client.query<{ table_name: string }>(tablesQuery);
    console.log(`   Found ${tablesResult.rows.length} tables:`);
    tablesResult.rows.forEach(r => console.log(`   ✓ ${r.table_name}`));

    // Check users count
    console.log('\n2️⃣  Checking users...');
    const usersQuery = `SELECT id, email, first_name FROM users LIMIT 5`;
    const usersResult = await client.query<{ id: string; email: string; first_name: string }>(usersQuery);
    console.log(`   Found ${usersResult.rowCount} users:`);
    usersResult.rows.forEach(u => console.log(`   - ${u.email} (${u.first_name})`));

    if (usersResult.rows.length > 0) {
      const adminUser = usersResult.rows.find(u => u.email === 'admin@dev-org.local');
      if (adminUser) {
        console.log(`\n3️⃣  Checking roles for admin user (${adminUser.id})...`);

        // Direct user_roles query
        const userRolesQuery = `
          SELECT ur.id, ur.user_id, ur.role_id, ur.organization_id, r.id as role_id_check, r.name
          FROM user_roles ur
          LEFT JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = $1
        `;
        const userRolesResult = await client.query<any>(userRolesQuery, [adminUser.id]);
        console.log(`   Found ${userRolesResult.rowCount} user_role entries:`);
        userRolesResult.rows.forEach(ur => {
          console.log(`   - Role: ${ur.name || 'NULL'} (role_id: ${ur.role_id}, org_id: ${ur.organization_id})`);
        });

        if (userRolesResult.rowCount === 0) {
          console.log('\n   ⚠️  No roles assigned to admin user! Checking all user_roles...');
          const allUserRolesQuery = `SELECT COUNT(*) as count FROM user_roles`;
          const allUserRolesResult = await client.query<{ count: string }>(allUserRolesQuery);
          console.log(`   Total user_roles records: ${allUserRolesResult.rows[0].count}`);
        }
      }
    }

    // Check roles
    console.log('\n4️⃣  Checking roles...');
    const rolesQuery = `SELECT id, name, organization_id FROM roles LIMIT 10`;
    const rolesResult = await client.query<{ id: string; name: string; organization_id: string }>(rolesQuery);
    console.log(`   Found ${rolesResult.rowCount} roles:`);
    rolesResult.rows.forEach(r => console.log(`   - ${r.name} (org: ${r.organization_id})`));

    // Check organizations
    console.log('\n5️⃣  Checking organizations...');
    const orgsQuery = `SELECT id, name FROM organizations LIMIT 5`;
    const orgsResult = await client.query<{ id: string; name: string }>(orgsQuery);
    console.log(`   Found ${orgsResult.rowCount} organizations:`);
    orgsResult.rows.forEach(o => console.log(`   - ${o.name} (${o.id})`));

    // Check permissions
    console.log('\n6️⃣  Checking permissions...');
    const permsQuery = `SELECT COUNT(*) as count FROM permissions`;
    const permsResult = await client.query<{ count: string }>(permsQuery);
    console.log(`   Total permissions: ${permsResult.rows[0].count}`);

    console.log('\n✅ Diagnostics complete\n');
  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runDiagnostics().catch(console.error);
}
