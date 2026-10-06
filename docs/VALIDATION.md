# V0.1 validation — 2026-10-06

## Passed

- Repeatable install via scripts/install.sh: locked npm ci, PostgreSQL migrations, tests, production build.
- 13 calculation/database/private-storage/TLS configuration test cases: all passed, none skipped. Database assertions also exercise the workspace aggregation with real PostgreSQL driver date values and missing-currency coverage.
- TypeScript check and optimized Next.js production build.
- Chromium browser smoke against the production server: demo session, unauthenticated/cross-origin rejection, request size/JSON validation, both store themes, invoice PNG upload/confirmation, persistence after reload, private attachment download, one linked obligation, personal owner tax record, payment recording, cash snapshot, interactive scaling, unavailable inventory/connections, mobile navigation and no page overflow.
- Password login and incorrect-password rejection using an explicitly fictional Operations Manager test account. Owner-only balance/tax writes are rejected for Ops; private payroll/personal obligation details are excluded from Ops workspace responses.
- Separate live-mode startup: demo login rejected and password login UI shown. No live database was supplied or contacted.
- Production dependency audit: zero reported vulnerabilities at the check time. This is a point-in-time dependency result, not a general security guarantee.
- Local documentation links and git diff whitespace check.

## Not verified / not implemented

External PostgreSQL/Supabase connectivity, real user provisioning against an external DB, live object storage, Shopify/Meta/CJ APIs, webhooks, OCR, live financial reconciliation, full inventory forecasts, exact scaling funding needs, live tax/payroll calculations, production deployment, environment publication and restoration in a new task.

Desktop screenshots are captured from the real running app with clearly labeled fictional DEMO data:

- [Godisabove](screenshots/godisabove.png)
- [Godisabove USA](screenshots/godisabove-usa.png)

Browser smoke fixtures and their generated records are fictional and isolated from live mode. The demo app is left running locally; live processes will need restarting after environment restoration. Installation/start instructions were saved in the environment draft; the user still needs to review/save and publish it.

## Live foundation follow-up

Migration 003 and isolated demo invoice upload/download passed the production browser smoke. The official Supabase SDK contract tests validate public-bucket rejection, upload/download/removal, immutable bucket location and traversal rejection using fictional HTTP responses. They do not contact Supabase. `APP_MODE=live npm run live:check` exited 1 as expected with no project credentials/public origin; external readiness remains blocked. Verified-TLS configuration, secure bootstrap account validation, private storage adapter and setup documentation are implemented.

Actual pg client configuration parsing was checked without opening a network connection: insecure SSL URL overrides and search_path overrides cannot defeat verified TLS or the application schema.
