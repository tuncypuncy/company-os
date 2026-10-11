# Company OS

A private financial and operational workspace for Godisabove, Godisabove USA and 360 Faucet across confirmed legal entities. Godisabove uses #FFD602; Godisabove USA uses #877AF5. Ownership, tax treatment and real economics require reviewed evidence.

## Working application

Store/brand/group/entity/currency/custom-date reporting; effective-dated nonlinear bundle COGS and preserved estimates; invoice reconciliation revisions; reviewed refunds and prepaid pools; expenses/subscriptions/price history; payroll and owner schedules; invoices/private attachments/local OCR proposals; partial/full payments; cash accounts and expected settlements; rolling 24h/48h/72h/7d forecasts; Meta credit/payment/clearing analysis; supplier SKUs, recursive BOMs, warehouses, US inventory, physical velocity, inbound history/receipts, stockout alerts and reviewed purchase planning; combined scaling scenarios; alert acknowledgements; FX source reporting; actor audits and source drill-downs.

Password/session authentication enforces Owner/Operations Manager permissions. Connections provides real server adapters and configuration without exposing tokens. All external connections remain unverified. DEMO economic fixtures are explicitly labeled and isolated; never upload real business evidence into demo mode.

## Run

Use Node 24 and the existing checkout:

    npm_config_cache=/tmp/company-os-npm npm ci
    npm run db:migrate
    npm run dev

APP_MODE defaults to demo. Enter the demo workspace. PGlite persists in ignored .data/demo; use one process per data directory and stop the application before database CLI commands. Private demo files are separate. The server binds to loopback.

## Validation

    npm test
    npm run typecheck
    npm run build

Browser tests mutate fictional demo records only. With a running isolated demo server, run npm run test:operations-smoke. For the baseline invoice/auth/mobile test, stop the server, run npx tsx scripts/smoke-fixture.ts using the same isolated DEMO_DATA_DIR, restart, then npm run test:smoke. Never aim smoke tests at live books. PLAYWRIGHT_CHROMIUM_EXECUTABLE defaults to /usr/bin/chromium; SMOKE_BASE_URL selects the test server; SMOKE_ARTIFACTS_DIR selects screenshots.

npm run test:native requires explicitly supplied NATIVE_TEST_DATABASE_URL and NATIVE_TEST_CA_FILE for an isolated native PostgreSQL fixture. It verifies real-driver TLS, repeatable migrations, transactions, actor audits and live-mode demo isolation; it is not an external Supabase connectivity test. scripts/webhook-smoke.ts additionally requires a local live fixture server with the explicitly fictional signing secret documented in that script; never target live books.

## Live setup

Read [INTEGRATION_SETUP.md](docs/INTEGRATION_SETUP.md) for exact Supabase, Shopify, Meta and CJ steps/required information. Configure ignored .env.local or secure deployment environment variables. Never use NEXT_PUBLIC secrets. Live requires an exact HTTPS origin, verified-TLS PostgreSQL, real owner and private durable attachment storage. Migrations seed no financial demo records. Run npm run live:check after provisioning.

Schedule npm run integrations:sync for authorized provider polling and npm run operations:tick for recurring obligations. No automatic payments, ad changes or supplier purchase submissions occur. Current-password change and owner account management work; password recovery, MFA, SSO and email invitations remain unimplemented.

## Boundaries

All external providers are NOT CONNECTED. Shopify schema/scopes require installed-store validation; processing fees/payouts are manual. Meta CBO/lifetime budgets and billing credit need reviewed inputs. CJ requires a current verified official inventory profile; auth refresh/logistics are not implemented. Taxes/withholding amounts and deadlines are supplied manually; the app does not determine legal tax treatment.

Cash snapshots do not change automatically when payments are recorded. Estimated supplier cash timing, ROAS and warehouse routing must be explicit scenario assumptions. Shared stock is not silently allocated among stores. Different currencies retain original totals; FX translation requires explicit sourced rates. OCR proposes fields and never posts them without review; scanned PDFs currently require image/manual input. Generic expense evidence may be linked to an existing invoice obligation; arbitrary multi-store invoice splitting remains future work.

External production deployment still needs backups/restore testing, monitoring, retention/orphan reconciliation, account security and representative live reconciliation. [IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) gives the precise scope.

## Persistent knowledge

Read [AGENTS.md](AGENTS.md), [business context](docs/BUSINESS_CONTEXT.md), [financial rules](docs/FINANCIAL_RULES.md), [catalog](docs/PRODUCT_CATALOG.md), [entity map](docs/ENTITY_MAP.md), [integrations](docs/INTEGRATIONS.md), [data dictionary](docs/DATA_DICTIONARY.md), [decisions](docs/DECISIONS.md), [design system](docs/DESIGN_SYSTEM.md) and [validation](docs/VALIDATION.md). MASTER_SPECIFICATION_V2.md is the preserved authoritative backlog, subject to newer owner instructions.

## Manual production setup workflow

[GitHub Actions live setup](docs/GITHUB_LIVE_SETUP.md) runs only when manually dispatched on main, using separate migration/runtime credentials. It applies existing migrations/runtime grants, verifies or creates the private bucket and initial owner without resetting existing records, then runs live:check. The guide contains one complete GitHub secret list and the exact settings/run screens. The confirmed application origin is https://company-os-eight-iota.vercel.app.
