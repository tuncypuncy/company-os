# Manual GitHub Actions live setup

User-confirmed production origin: https://company-os-eight-iota.vercel.app.
Workflow: .github/workflows/live-setup.yml, Actions name **Company OS live setup**.
Only workflow_dispatch on main runs setup. No push/PR/schedule trigger, no write GitHub token, no artifact upload, no debug tracing, and secret values are injected only into the setup step after dependency installation.

## Add these GitHub repository secrets — one list

Open https://github.com/tuncypuncy/company-os/settings/secrets/actions
or repository **Settings → Secrets and variables → Actions → Repository secrets → New repository secret**.

| Secret | Required value |
| --- | --- |
| DATABASE_MIGRATION_URL | Existing privileged Supabase PostgreSQL connection, capable of migrations, creating restricted login/group roles and granting membership. Use the session pooler on aws-1-eu-central-1.pooler.supabase.com:5432. Never use transaction port 6543. |
| DATABASE_URL | Same database/host/port, with dedicated username company_os_app.fgpatnkzvvqfkwdfzicp and its own strong password (24–256 printable ASCII characters). Workflow creates company_os_app only if absent; it never resets an existing database password. Percent-encode URL credential characters. |
| SUPABASE_URL | https://fgpatnkzvvqfkwdfzicp.supabase.co |
| SUPABASE_SERVICE_ROLE_KEY | This project's server-only Storage service-role key; never an anon/publishable key. |
| BOOTSTRAP_EMAIL | Intended real owner login email. |
| BOOTSTRAP_NAME | Intended real owner name. |
| BOOTSTRAP_PASSWORD | Initial user-provided password, 14–256 characters. Required to create a new owner; can be removed after successful setup. A matching existing active owner is preserved without this secret. |
| DATABASE_CA_CERT | Optional: trusted provider CA PEM content, if system CA verification is insufficient. Workflow writes a temporary mode-0600 certificate file and removes it afterwards. Never disable TLS verification. |

DATABASE_URL format (replace the placeholder securely, not in source):
postgresql://company_os_app.fgpatnkzvvqfkwdfzicp:<URL_ENCODED_RUNTIME_PASSWORD>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres

APP_ORIGIN, APP_MODE=live, PRIVATE_STORAGE_PROVIDER=supabase, SUPABASE_STORAGE_BUCKET=company-os-invoices and BOOTSTRAP_ROLE=OWNER are explicitly configured in the workflow. They are not additional GitHub secrets. The owner password is hashed locally, not proxy-injected. Do not set bootstrap credentials on the Vercel web process.

## Run manually

After the reviewed commit is on main: repository **Actions → Company OS live setup → Run workflow → Branch: main → Run workflow**.
The setup concurrency group prevents overlap from this workflow. A PostgreSQL advisory lock serializes separate executions too. A rerun resumes completed migrations; it is not an all-or-nothing database/storage transaction.

Stages:
1. Validate live mode, origin, project/endpoint consistency and dedicated runtime username. Reject transaction pooling and mismatched projects. No demo seed path is called.
2. Reject an existing demo-account database without deleting anything. Apply the existing nine migrations through the privileged connection.
3. Create dedicated company_os_app login only when absent, using a client-derived SCRAM verifier from the supplied runtime URL password; plaintext password is not embedded in DDL. Apply db/provision-runtime.sql, grant company_os_runtime to the login and verify runtime identity/TLS. Refuse excessive role flags, unexpected inherited memberships, schema/object ownership, schema CREATE or runtime UPDATE/DELETE permissions on audit_logs/schema_migrations.
4. Inspect Storage bucket. Create only after an actual 404, private, max 10 MB, PDF/PNG/JPEG. Existing public/unrestricted buckets require manual review; the workflow does not convert or delete them. Authentication/network errors do not trigger creation.
5. Create an initial real owner only if missing. Preserve a matching active owner/password/name. A matching Ops/disabled/demo account or a different existing active owner stops for manual review, without promotion/reset/deletion.
6. Run the existing scripts/live-check.ts using runtime credentials, excluding administrator and bootstrap secrets. Stage labels/PASS messages are printed; raw provider/SQL errors and secret values are withheld.

The workflow never drops/resets/truncates financial tables, inserts demo economics, overwrites owner credentials, deletes storage objects or starts integrations. Existing migrations are applied unchanged; inspect future migration changes before dispatching.

## Vercel server configuration after setup

**Vercel dashboard → Company OS project → Settings → Environment Variables**, Production:
APP_MODE=live, APP_ORIGIN=https://company-os-eight-iota.vercel.app,
DATABASE_URL=same dedicated runtime connection,
PRIVATE_STORAGE_PROVIDER=supabase, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
SUPABASE_STORAGE_BUCKET=company-os-invoices.
If a CA file is needed, provide trusted CA content through the hosting-supported file mechanism and set DATABASE_CA_FILE. Do not put DATABASE_MIGRATION_URL or bootstrap credentials in Vercel runtime. Redeploy after changing variables.

A passing GitHub live:check proves database/owner/private-bucket readiness from that runner. It does not prove the deployed Vercel process has the new variables, successful interactive login, attachment upload/download, commerce integration access or backups. Test those after redeployment. No live setup has been executed from Codex.

Validation: 31 local tests passed, TypeScript and workflow YAML/manual-trigger/permission checks passed. Native PostgreSQL 17 accepted all migration SQL, authenticated the SCRAM runtime login, and verified runtime grants/audit protections in a disposable fictional fixture. These checks do not establish actual Supabase/GitHub execution.
