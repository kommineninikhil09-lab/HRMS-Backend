/**
 * Drops undocumented schema drift: `role_permissions.scope` (type
 * `permission_scope`, enum SELF/TEAM/ORGANIZATION) exists in the real
 * database but no migration on `main` ever created it — confirmed by
 * grepping `migrations/` for `permission_scope` (no matches) and reading
 * `1724210000000_rbac_scope_and_role_consolidation.ts`, the migration that
 * actually built this repo's authorization schema (`scope.all` permission,
 * `manager_scopes` table), which never references it either.
 *
 * This column belongs to a different, abandoned authorization design
 * (per-permission scope grants + a ScopeService/ScopeGuard) that was never
 * built on `main` — `main` uses `manager_scopes` + `TenantContext.scope`
 * instead (see `src/common/scope/scope.util.ts`). Nothing in the running
 * application reads `role_permissions.scope` or references the
 * `permission_scope` type — confirmed by grepping `src/`. It is dead,
 * exactly like the `leave-management` module removed in a prior migration
 * of dead code (not a DB migration — see the deleted `src/leave-management/`
 * directory).
 */

export async function up(pgm: any): Promise<void> {
  await pgm.sql(`
    ALTER TABLE role_permissions DROP COLUMN IF EXISTS scope;
  `);
  await pgm.sql(`
    DROP TYPE IF EXISTS permission_scope;
  `);
}

export async function down(pgm: any): Promise<void> {
  // Reversible for completeness, but nothing in the application reads this
  // column — down() exists so the migration is symmetric, not because
  // anything depends on the column coming back.
  await pgm.sql(`
    DO $$ BEGIN
      CREATE TYPE permission_scope AS ENUM ('SELF', 'TEAM', 'ORGANIZATION');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await pgm.sql(`
    ALTER TABLE role_permissions
    ADD COLUMN IF NOT EXISTS scope permission_scope NOT NULL DEFAULT 'SELF';
  `);
}
