import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hrms_admin:HRMS@4AT@localhost:5432/hrms_dev',
});

export async function bootstrapDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔧 Bootstrapping database...');

    // Create user_roles table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        user_id UUID NOT NULL,
        role_id UUID NOT NULL,
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        assigned_by UUID,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(organization_id, user_id, role_id)
      );
    `);
    console.log('✓ user_roles table ready');

    // Create roles table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_system BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(organization_id, name)
      );
    `);
    console.log('✓ roles table ready');

    // Create permissions table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        module VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✓ permissions table ready');

    // Create role_permissions table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID,
        role_id UUID NOT NULL,
        permission_id UUID NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(role_id, permission_id)
      );
    `);
    console.log('✓ role_permissions table ready');

    console.log('✅ Database bootstrap complete');
  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
  } finally {
    client.release();
  }
}

// Auto-bootstrap on import if in development
if (process.env.NODE_ENV !== 'production') {
  bootstrapDatabase().catch(console.error);
}

export async function closePool() {
  await pool.end();
}
