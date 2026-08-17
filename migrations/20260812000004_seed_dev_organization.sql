-- This migration is for development environments only
-- In production, organizations are created via the application UI

-- Seed a dev organization (if running in development)
-- This will be used for local testing
INSERT INTO organizations (name, legal_name, slug, status, timezone)
VALUES (
  'Dev Organization',
  'Dev Organization Inc.',
  'dev-org',
  'active',
  'UTC'
)
ON CONFLICT (slug) DO NOTHING;
