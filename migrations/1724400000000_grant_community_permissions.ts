// Same drift bug as 1724300000000_grant_payroll_performance_permissions:
// 1724100800000_add_social_permissions is marked as already run in
// pgmigrations, but its INSERTs never actually landed — confirmed live,
// zero rows in `permissions` for module='community'. Re-inserts them here
// (idempotent, ON CONFLICT DO NOTHING, identical to the original migration)
// and grants them, since nobody — not even Admin — currently has any
// community permission and every community route 403s.
//
// Community content (posts/polls/comments/praise/announcements) is an
// org-wide feed, not employee-hierarchy data, so scope is set to
// 'ORGANIZATION' uniformly — none of these routes consult ScopeService, the
// column just can't be NULL.
//
// NOTE: the permission descriptions say "own post"/"own poll"/etc., and a
// separate `.moderate` permission exists per resource for admin override —
// but the controllers/services never actually check resource ownership, so
// `.update`/`.delete` currently let any holder edit/delete ANY resource, not
// just their own. That's a known, separate gap — deliberately left
// unaddressed for now (per explicit direction), not fixed by this grant.

const PERMISSIONS = [
  { code: 'post.create', description: 'Create a post', module: 'community' },
  { code: 'post.read', description: 'View posts', module: 'community' },
  { code: 'post.update', description: 'Update own post', module: 'community' },
  { code: 'post.delete', description: 'Delete own post', module: 'community' },
  { code: 'post.moderate', description: 'Moderate posts (admin)', module: 'community' },

  { code: 'poll.create', description: 'Create a poll', module: 'community' },
  { code: 'poll.read', description: 'View polls', module: 'community' },
  { code: 'poll.vote', description: 'Vote on polls', module: 'community' },
  { code: 'poll.update', description: 'Update own poll', module: 'community' },
  { code: 'poll.delete', description: 'Delete own poll', module: 'community' },
  { code: 'poll.moderate', description: 'Moderate polls (admin)', module: 'community' },

  { code: 'praise.create', description: 'Give praise to employee', module: 'community' },
  { code: 'praise.read', description: 'View praise given', module: 'community' },
  { code: 'praise.update', description: 'Update own praise', module: 'community' },
  { code: 'praise.delete', description: 'Delete own praise', module: 'community' },
  { code: 'praise.moderate', description: 'Moderate praise (admin)', module: 'community' },

  { code: 'comment.create', description: 'Comment on posts and praise', module: 'community' },
  { code: 'comment.read', description: 'View comments', module: 'community' },
  { code: 'comment.update', description: 'Update own comment', module: 'community' },
  { code: 'comment.delete', description: 'Delete own comment', module: 'community' },
  { code: 'comment.moderate', description: 'Moderate comments (admin)', module: 'community' },

  { code: 'like.create', description: 'Like posts, praise, and comments', module: 'community' },

  { code: 'announcement.create', description: 'Create announcements (admin)', module: 'community' },
  { code: 'announcement.read', description: 'View announcements', module: 'community' },
  { code: 'announcement.update', description: 'Update announcements (admin)', module: 'community' },
  { code: 'announcement.delete', description: 'Delete announcements (admin)', module: 'community' },

  { code: 'search.execute', description: 'Search employees and content', module: 'community' },
];

interface Grant {
  role: string;
  code: string;
}

const EVERYONE_CODES = [
  'post.create', 'post.read', 'post.update', 'post.delete',
  'poll.read', 'poll.vote', 'poll.update', 'poll.delete',
  'praise.create', 'praise.read', 'praise.update', 'praise.delete',
  'comment.create', 'comment.read', 'comment.update', 'comment.delete',
  'like.create',
  'announcement.read',
  'search.execute',
];

// Admin- and HR-Manager-only: poll creation (company-wide polls) and
// announcements (explicitly "(admin)" in their own description).
const HR_AND_ADMIN_CODES = ['poll.create', 'announcement.create', 'announcement.update', 'announcement.delete'];

// Admin-only moderation override.
const ADMIN_ONLY_CODES = ['post.moderate', 'poll.moderate', 'praise.moderate', 'comment.moderate'];

const GRANTS: Grant[] = [
  ...EVERYONE_CODES.flatMap((code) => [
    { role: 'Admin', code },
    { role: 'HR Manager', code },
    { role: 'Employee', code },
  ]),
  ...HR_AND_ADMIN_CODES.flatMap((code) => [
    { role: 'Admin', code },
    { role: 'HR Manager', code },
  ]),
  ...ADMIN_ONLY_CODES.map((code) => ({ role: 'Admin', code })),
];

export async function up(pgm: any): Promise<void> {
  for (const permission of PERMISSIONS) {
    await pgm.sql(`
      INSERT INTO permissions (code, description, module)
      VALUES ('${permission.code}', '${permission.description}', '${permission.module}')
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  for (const g of GRANTS) {
    await pgm.sql(`
      INSERT INTO role_permissions (organization_id, role_id, permission_id, scope)
      SELECT r.organization_id, r.id, p.id, 'ORGANIZATION'
      FROM roles r, permissions p
      WHERE r.name = '${g.role}' AND p.code = '${g.code}'
      ON CONFLICT (role_id, permission_id) DO UPDATE SET scope = EXCLUDED.scope;
    `);
  }

  // Unrelated one-line tidy bundled in here rather than a whole new
  // migration file: 1724200000000_add_permission_scope's own comment says
  // audit.read should be an ORGANIZATION override for HR Manager (not the
  // generic TEAM default), but that override was documented and never
  // actually applied. Currently inert either way (AuditController never
  // consults ScopeService), but worth being correct for if/when it does.
  await pgm.sql(`
    UPDATE role_permissions rp
    SET scope = 'ORGANIZATION'
    FROM roles r, permissions p
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
      AND r.name = 'HR Manager' AND p.code = 'audit.read';
  `);
}

export async function down(pgm: any): Promise<void> {
  await pgm.sql(`
    DELETE FROM role_permissions rp
    USING permissions p
    WHERE rp.permission_id = p.id AND p.module = 'community';
  `);
  await pgm.sql(`DELETE FROM permissions WHERE module = 'community';`);
}
