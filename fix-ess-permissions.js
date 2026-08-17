const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hrms_user:hrms_password@localhost:5432/hrms',
});

async function fixPermissions() {
  const client = await pool.connect();
  try {
    console.log('Fixing ESS permissions...');

    // 1. Get organization ID
    const orgResult = await client.query(
      "SELECT id FROM organizations WHERE slug = 'dev-org'"
    );
    const organizationId = orgResult.rows[0].id;
    console.log('Organization ID:', organizationId);

    // 2. Get Admin role ID
    const roleResult = await client.query(
      "SELECT id FROM roles WHERE name = 'Admin' AND organization_id = $1",
      [organizationId]
    );
    const adminRoleId = roleResult.rows[0].id;
    console.log('Admin Role ID:', adminRoleId);

    // 3. Insert ESS permissions if they don't exist
    const permissionsToInsert = [
      ['ess.read', 'View employee self-service profile and documents', 'ess'],
      ['ess.update', 'Update own employee profile', 'ess'],
    ];

    const permissionIds = {};
    for (const [code, description, module] of permissionsToInsert) {
      const result = await client.query(
        `INSERT INTO permissions (code, description, module)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET code = $1
         RETURNING id`,
        [code, description, module]
      );
      permissionIds[code] = result.rows[0].id;
      console.log(`Permission ${code} ID:`, permissionIds[code]);
    }

    // 4. Assign permissions to Admin role
    for (const code of ['ess.read', 'ess.update']) {
      await client.query(
        `INSERT INTO role_permissions (organization_id, role_id, permission_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [organizationId, adminRoleId, permissionIds[code]]
      );
      console.log(`Assigned ${code} to Admin role`);
    }

    console.log('✅ ESS permissions fixed successfully!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixPermissions();
