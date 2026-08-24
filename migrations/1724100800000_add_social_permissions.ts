
export async function up(pgm: any): Promise<void> {
  // Insert social/community feature permissions
  const permissions = [
    // Posts permissions
    { code: 'post.create', description: 'Create a post', module: 'community' },
    { code: 'post.read', description: 'View posts', module: 'community' },
    { code: 'post.update', description: 'Update own post', module: 'community' },
    { code: 'post.delete', description: 'Delete own post', module: 'community' },
    { code: 'post.moderate', description: 'Moderate posts (admin)', module: 'community' },

    // Polls permissions
    { code: 'poll.create', description: 'Create a poll', module: 'community' },
    { code: 'poll.read', description: 'View polls', module: 'community' },
    { code: 'poll.vote', description: 'Vote on polls', module: 'community' },
    { code: 'poll.update', description: 'Update own poll', module: 'community' },
    { code: 'poll.delete', description: 'Delete own poll', module: 'community' },
    { code: 'poll.moderate', description: 'Moderate polls (admin)', module: 'community' },

    // Praise permissions
    { code: 'praise.create', description: 'Give praise to employee', module: 'community' },
    { code: 'praise.read', description: 'View praise given', module: 'community' },
    { code: 'praise.update', description: 'Update own praise', module: 'community' },
    { code: 'praise.delete', description: 'Delete own praise', module: 'community' },
    { code: 'praise.moderate', description: 'Moderate praise (admin)', module: 'community' },

    // Comments permissions
    { code: 'comment.create', description: 'Comment on posts and praise', module: 'community' },
    { code: 'comment.read', description: 'View comments', module: 'community' },
    { code: 'comment.update', description: 'Update own comment', module: 'community' },
    { code: 'comment.delete', description: 'Delete own comment', module: 'community' },
    { code: 'comment.moderate', description: 'Moderate comments (admin)', module: 'community' },

    // Likes permissions
    { code: 'like.create', description: 'Like posts, praise, and comments', module: 'community' },

    // Announcements permissions
    { code: 'announcement.create', description: 'Create announcements (admin)', module: 'community' },
    { code: 'announcement.read', description: 'View announcements', module: 'community' },
    { code: 'announcement.update', description: 'Update announcements (admin)', module: 'community' },
    { code: 'announcement.delete', description: 'Delete announcements (admin)', module: 'community' },

    // Search permissions
    { code: 'search.execute', description: 'Search employees and content', module: 'community' },
  ];

  for (const permission of permissions) {
    pgm.sql(`
      INSERT INTO permissions (code, description, module)
      VALUES ('${permission.code}', '${permission.description}', '${permission.module}')
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  console.log('Social feature permissions inserted');
}

export async function down(pgm: any): Promise<void> {
  // Remove social feature permissions
  pgm.sql(`
    DELETE FROM permissions WHERE module = 'community';
  `);
}

