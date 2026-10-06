# Integrations

## Actual state — 2026-10-06

No external service is connected. Configuration, fixture tests and local PostgreSQL validation do not establish live access.

| Source | Implemented | Actual connection / limits |
| --- | --- | --- |
| PostgreSQL / Supabase database | Verified-TLS server adapter, nine migrations, isolated company_os schema, administrator/runtime permission split | Native PostgreSQL 17 fixture passed; actual Supabase project unavailable |
| Supabase Storage | Official SDK private bucket checks, authenticated upload/download, provider-specific object metadata and rollback cleanup | Fictional SDK contracts tested; actual project unconnected |
| Shopify | GraphQL catalog/orders/refunds, nested pagination, raw retention, effective entity mapping, physical bundles, HMAC webhook queue and bounded sync worker | NOT CONNECTED; installed-shop schema/scopes need validation; no payout/fee adapter, OAuth or token refresh |
| Meta | Account verification, daily actual spend, paginated ad-set evidence and complete daily-budget coverage checks | NOT CONNECTED; no inferred billing credit, CBO/lifetime budget totals, payments or ad mutations |
| CJ | Strict documented inventory-profile transport, SKU/warehouse mapping and availability validation | NOT CONNECTED; official docs network-blocked; endpoint/profile still requires verification; no token exchange/refresh or logistics API |
| Local invoice extraction | Tesseract PNG/JPG and pdftotext proposals, scanned-PDF rasterization, bounded resource use, mandatory human review | No external credentials; requires deployment binaries; scanned PDFs need image/manual input |
| Apps, payroll, owners, tax, banks | Reviewed manual records, subscriptions/price history, schedules, partial payments, balance snapshots and expected settlements | No automatic bank/payroll/tax feeds or invented rates/deadlines |
| Google / Amazon / Triple Whale | Business-context extension boundaries | Not implemented or connected |

## Source handling

Connections store nonsecret identities and credential variable names. Tokens remain server-only. Failed checks are visible and never imply success. Sync logs preserve bounded windows, errors and last success; raw provider records remain private. Import IDs and events are deduplicated. Shopify events trigger authoritative GraphQL sync rather than unreviewed webhook financial posting. Source timestamps, verification labels and freshness accompany records.

Demo uses the same relational/domain interfaces with DEMO labels and never calls real provider APIs. Missing fees/refund basis/COGS/ad coverage block definitive profit. Meta credit remains reviewed manual evidence; imported spend is accrual, not a duplicate cash obligation.

Read [INTEGRATION_SETUP.md](INTEGRATION_SETUP.md) for exact required information, server variables, connection steps, scheduling and provider limitations. Read [LIVE_SETUP.md](LIVE_SETUP.md) for storage and authentication deployment boundaries. No secret values belong in these documents.
