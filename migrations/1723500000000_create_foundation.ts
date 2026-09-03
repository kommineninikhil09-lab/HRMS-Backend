/**
 * Phase 0 — foundational auth / RBAC / tenancy tables.
 *
 * These tables (organizations, users, roles, permissions, user_roles,
 * role_permissions, refresh_tokens, audit_logs) were previously assumed to
 * already exist: the migration series started at `create_business_units`, which
 * references `organizations(id)` and `users(id)`, and only `seed.ts` /
 * `create-all-tables.sql` ever defined them. This migration makes the schema
 * reproducible from `node-pg-migrate up` alone.
 *
 * It is written as idempotent `CREATE TABLE IF NOT EXISTS` (rather than
 * `pgm.createTable`) so it is a safe no-op on databases that already have these
 * tables from the old bootstrap path, and creates them cleanly on a fresh DB.
 * Column definitions are reconstructed from the repository layer and seed.ts.
 */

export async function up(pgm: any): Promise<void> {
  await pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    -- organizations (root tenant table; created_by/updated_by intentionally have
    -- no FK to users to avoid a circular dependency at bootstrap)
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      legal_name VARCHAR(255),
      slug VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID,
      updated_by UUID
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_slug ON organizations (slug);

    -- users
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id),
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255),
      auth_provider VARCHAR(50) NOT NULL DEFAULT 'local',
      external_id VARCHAR(255),
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id)
    );
    -- case-insensitive uniqueness; matches seed.ts "ON CONFLICT (lower(email))"
    CREATE UNIQUE INDEX IF NOT EXISTS uq_users_lower_email ON users (LOWER(email));
    CREATE INDEX IF NOT EXISTS idx_users_org ON users (organization_id);

    -- roles
    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_system BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id),
      CONSTRAINT uq_roles_org_name UNIQUE (organization_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_roles_org ON roles (organization_id);

    -- permissions (global catalog; no organization_id, code is globally unique)
    CREATE TABLE IF NOT EXISTS permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(100) NOT NULL,
      description TEXT,
      module VARCHAR(50),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_permissions_code UNIQUE (code)
    );

    -- role_permissions
    CREATE TABLE IF NOT EXISTS role_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id),
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_role_permissions UNIQUE (role_id, permission_id)
    );
    CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role_id);
    CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions (permission_id);

    -- user_roles
    CREATE TABLE IF NOT EXISTS user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      assigned_by UUID REFERENCES users(id),
      CONSTRAINT uq_user_roles UNIQUE (user_id, role_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles (user_id);
    CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles (role_id);

    -- refresh_tokens
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      replaced_by_token_id UUID REFERENCES refresh_tokens(id),
      created_by_ip VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);

    -- audit_logs (append-only; entity_id is VARCHAR because some callers store
    -- composite keys like "<roleId>:<permissionCode>")
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id),
      request_id VARCHAR(100),
      actor_user_id UUID REFERENCES users(id),
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(100) NOT NULL,
      entity_id VARCHAR(255),
      old_value JSONB,
      new_value JSONB,
      ip_address VARCHAR(64),
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs (organization_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_user_id);
  `);
}

export async function down(pgm: any): Promise<void> {
  // Dev-only convenience; drops in reverse dependency order.
  await pgm.sql(`
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP TABLE IF EXISTS refresh_tokens CASCADE;
    DROP TABLE IF EXISTS user_roles CASCADE;
    DROP TABLE IF EXISTS role_permissions CASCADE;
    DROP TABLE IF EXISTS permissions CASCADE;
    DROP TABLE IF EXISTS roles CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS organizations CASCADE;
  `);
}
