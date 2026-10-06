-- Run as the schema/migration administrator AFTER migrations.
-- This creates a NOLOGIN permission group, not a credential or a guessed login.
-- Grant this group to the dedicated application login using your admin console.
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='company_os_runtime') THEN CREATE ROLE company_os_runtime NOLOGIN; END IF; END $$;
GRANT USAGE ON SCHEMA company_os TO company_os_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA company_os TO company_os_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA company_os TO company_os_runtime;
REVOKE INSERT, UPDATE, DELETE ON company_os.schema_migrations FROM company_os_runtime;
REVOKE UPDATE, DELETE ON company_os.audit_logs FROM company_os_runtime;
-- Re-run grants after new migrations. Never give this login schema ownership,
-- CREATE, SUPERUSER, BYPASSRLS, or browser/anonymous access. Migration credentials
-- are deployment-only and must not remain in the web process environment.
