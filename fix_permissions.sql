-- Fix table ownership
ALTER TABLE IF EXISTS employees OWNER TO hrms_admin;
ALTER TABLE IF EXISTS business_units OWNER TO hrms_admin;
ALTER TABLE IF EXISTS locations OWNER TO hrms_admin;
ALTER TABLE IF EXISTS departments OWNER TO hrms_admin;
ALTER TABLE IF EXISTS grades OWNER TO hrms_admin;
ALTER TABLE IF EXISTS designations OWNER TO hrms_admin;
ALTER TABLE IF EXISTS teams OWNER TO hrms_admin;

-- Check applied migrations
SELECT * FROM pgmigrations ORDER BY run_on DESC LIMIT 10;
