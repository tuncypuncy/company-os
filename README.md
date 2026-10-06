# Company OS

A private financial and operational control tower for Godisabove and 360 Faucet across Omurtak B.V. and Softdance LLC.

## Working V0.1

- Next.js / TypeScript application with yellow Godisabove and lavender Godisabove USA themes, responsive navigation, charts and entity/store/currency/date filters.
- Persistent isolated demo PostgreSQL (PGlite) and an external PostgreSQL adapter for live mode.
- Bundle-aware, effective-dated COGS calculations; missing and overlapping rules remain explicit. Trace order costs to rule IDs.
- Manual invoice/PDF/JPG/PNG upload, human confirmation, exact line-total validation, private download, audit history and one linked payment obligation.
- Manual cash snapshots, 24h/48h/72h/7d cash forecasts, dated obligations, payment recording and personal/company separation.
- Generic tax/payroll/owner-payment obligations, including filing date, period and jurisdiction. No tax rates or deadlines are inferred.
- Estimated Meta headroom and interactive spend/ROAS/COGS scenarios. Ad accrual is distinguished from cash due.
- Database-backed sessions, password hashing and server-side Owner/Operations Manager write permissions. Demo entry is explicitly not live authentication.

All seeded economics, accounts, attribution and credit facilities are **DEMO**, not confirmed business facts. Store ownership remains UNMAPPED. Do not upload real financial data to demo mode.

## Run locally

Recommended Node.js 24 (see `.nvmrc`). From the existing checkout:

```bash
cd /workspace/company-os
npm_config_cache=/tmp/company-os-npm npm ci
npm run db:migrate
npm run dev
```

`APP_MODE` defaults to `demo`; use the **Enter demo workspace** button. Demo data is saved in ignored `.data/demo`, attachments in `.data/demo-attachments`. Use one application process per demo database; stop it before running database CLI commands. The server binds to loopback by default. No separate Git worktree is needed.

For a repeatable install, migrations, tests and production build:

```bash
bash scripts/install.sh
npm start
```

## Validation

```bash
npm run test
npm run typecheck
npm run build
```

The tests exercise money precision, nonlinear bundle prices, historical boundaries, missing/ambiguous costs, cash deduplication, overdue/paid/personal obligations, currency/entity separation, zero denominators, settlement lag, real PostgreSQL migrations, atomic invoice posting and audit history.

Browser smoke test (uses **demo data only**, creates fictional invoices and payments): stop the app, run `npx tsx scripts/smoke-fixture.ts`, restart it, then run `npm run test:smoke`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to your installed Chromium if it is not `/usr/bin/chromium`. `SMOKE_BASE_URL` defaults to the local development server; `SMOKE_ARTIFACTS_DIR` controls screenshots. Never point this test at live data. Use an isolated `DEMO_DATA_DIR` when testing separately from your demo workspace.

## Live mode and secure configuration

Copy `.env.example` to ignored `.env.local` and supply credentials securely. Set `APP_MODE=live`, `DATABASE_URL`, and the exact HTTPS `APP_ORIGIN`. `npm run db:migrate` creates the isolated `company_os` schema and confirmed organizational names, without inventing ownership/account mappings or financial records. Direct browser/Supabase anonymous DB access is unsupported; use server-only credentials. TLS certificate verification must remain enabled; `DATABASE_CA_FILE` can supply a trusted CA.

Provision an account using secure `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD` (at least 14 characters), `BOOTSTRAP_NAME`, and `BOOTSTRAP_ROLE` (`OWNER` or `OPERATIONS_MANAGER`), then run `npm run user:create`. Remove bootstrap credentials afterward. There is no public signup, password reset or MFA yet. Live writes require `APP_ORIGIN`; demo login is rejected in live mode. Ops cannot mutate cost rules, balances, tax, payroll or personal owner obligations. Private obligation details are omitted from Ops responses; aggregate cash forecasts include company obligations.

Live file uploads require the implemented private Supabase Storage adapter, or `PRIVATE_STORAGE_PROVIDER=local` with a private persistent `PRIVATE_FILES_DIR` and `DURABLE_STORAGE_CONFIRMED=true`. Local storage is unsuitable for Vercel's ephemeral filesystem. External PostgreSQL/Supabase access remains unverified; deployment still needs credentials, backups and hardening. See docs/LIVE_SETUP.md.

## Explicit limitations

Shopify, Meta, CJ, Google, Amazon, Triple Whale and banks are **not connected**. Adapters/interfaces are prepared; no endpoints or API capabilities are fabricated. Invoice entry is manual; OCR/AI extraction is not implemented. Inventory/supply-chain pages show unavailable data and planned structures, not fake stock. No automated payments or purchase orders.

The scaling calculator is a simplified estimate: ROAS, COGS, refunds, fees and settlement delay. It reports incremental ad accrual and estimated settlements, **not exact incremental funding requirements** without billing/supplier/clearing schedules. Inventory capacity and a safe-to-scale verdict remain unavailable.

Cost-rule revision/reconciliation UI, prepaid consumption UI, custom catalog configuration UI, subscription editing/generation, detailed payroll calculations, tax computation, FX consolidation, source-driven live alerts and password recovery remain future work. Recording a payment settles a liability; manual cash snapshots must be refreshed separately. Live safety buffers are not configured by this version.

## Project knowledge

Read [AGENTS.md](AGENTS.md) first. Business facts live in [BUSINESS_CONTEXT.md](docs/BUSINESS_CONTEXT.md), calculations in [FINANCIAL_RULES.md](docs/FINANCIAL_RULES.md), unresolved mappings in [ENTITY_MAP.md](docs/ENTITY_MAP.md), catalog context in [PRODUCT_CATALOG.md](docs/PRODUCT_CATALOG.md), connection state in [INTEGRATIONS.md](docs/INTEGRATIONS.md), records in [DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md), and decisions in [DECISIONS.md](docs/DECISIONS.md).

[DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) records the visual direction. The original [HTML design study](docs/design-preview.html) is retained as reference; the real application is under `src/`.

See [validation evidence and screenshots](docs/VALIDATION.md) for the current verified scope.

## Live connection setup

See [docs/LIVE_SETUP.md](docs/LIVE_SETUP.md) for verified-TLS PostgreSQL, real owner/operations account provisioning, private Supabase Storage and `npm run live:check`. Storage implementation is tested with a fictional SDK contract; no external project has been connected.
