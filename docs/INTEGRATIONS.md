# Integrations

## Actual state

All application integrations are NOT IMPLEMENTED; none has been tested. No API limitations have been empirically discovered. The existing GitHub read operation succeeded during onboarding, which does not establish commerce API access. No commerce API credentials have been supplied. DATABASE_URL and Supabase variable presence were checked and absent; values were not printed.

Credential entries below describe requirements to determine during implementation, not exact environment variables, approved scopes, or verified API features. Consult current official documentation before choosing endpoints/scopes/versions. Never store credential values here.

| System | Priority and planned data | Authentication to arrange | Sync strategy / limitations | Last tested |
| --- | --- | --- | --- | --- |
| Shopify | First commerce integration: catalog, orders/items, discounts, shipping/tax, refunds, statuses, payouts where permitted | Verified shop identities, server-side authorized app credentials/token and webhook signing secret; least-privilege scopes verified for selected API | Historical paginated sync, incremental reconciliation, signed order/refund webhooks; payouts depend on provider/access; storefront domains are not sufficient shop IDs | NOT TESTED |
| Meta | High priority: spend/budgets/account status; billing/credit where available | Confirmed ad/billing account IDs and authorized server-side token/app access with verified permissions | Scheduled polling and backfill; billing fields are capability-dependent; manual invoices/credit/payment clearing fallback | NOT TESTED |
| CJ / suppliers | SKU mappings, warehouses, stock, fulfillment, supplier orders, purchase and shipment data | Actual CJ/supplier account identity and credentials required by official API | Inspect real API; poll/reconcile or use supported events; manual/import fallback for missing stock states, PO fields and ETA | NOT TESTED |
| Google Ads | Later direct integration; manual ad-spend input initially | Authorized account/customer IDs, OAuth and API access requirements verified against official docs | Spend backfill/polling; preserve actual spend versus budgets | NOT TESTED |
| Triple Whale | Later comparison/attribution, not authoritative internal finance | Authorized API credentials and workspace/store identity where API access permits | Capability-driven imports; never overwrite reconciled internal costs/refunds/profit | NOT TESTED |
| Amazon | Later orders, fees/FBA, inventory, settlements, refunds, advertising where available | Authorized seller/marketplace and application access per chosen API | Reconcile fees and payout timing; account/region permissions to verify | NOT TESTED |
| Banks / processors | Later balances, settlements and cash transactions | Provider/account selection and authorized connection | Manual balance snapshots first; no bank identities or refresh capabilities assumed | NOT TESTED |
| Invoice extraction | Reviewed supplier/expense invoice or screenshot input | Provider choice/credentials only if an external extraction service is selected | Private PDF/JPG/PNG storage → extraction/manual input → review → confirmation → reconciliation; no unattended posting | NOT TESTED |
| Apps/subscriptions, payroll, tax | Complete cost and obligation registry | None for manual input; provider-specific access only when selected | Manual/imported evidence first; scheduled recurring instances with updates/cancellation, no invented automatic feeds | NOT TESTED |

## Adapter requirements

Use separate server-side adapters and normalized models; retain useful raw source payloads privately with appropriate retention. Record connection identity, permissions/capabilities, external IDs, currency, source timestamps, sync cursor/window, last success, errors, and freshness thresholds. Verify signatures before webhook processing. Deduplicate by source/account/external event identity and make retries safe. Support pagination, rate limits, retry/backoff, replay, historical reconciliation, and explicit mapping review. Do not log secrets or unnecessary personal data.

Manual/demo/import sources use the same validated domain interfaces with explicit labels. A configured connection is not evidence of a successful sync. Unsupported fields remain UNAVAILABLE; manual values remain MANUAL. Keep source provenance and user overrides separate.

## Connection sequence after implementation

1. Confirm entity/store/account mappings in ENTITY_MAP.md and runtime configuration.
2. Implement the adapter against verified official API documentation, create migrations, and publish a credentials-free .env.example.
3. Configure credentials securely in environment settings; do not request values in chat.
4. Verify least-privilege read access, then backfill a bounded dataset with integrity checks.
5. Configure supported signed events or polling; verify duplicates, retries, freshness and reconciliation.
6. Test against representative records and update this file with real capabilities, issues, date, and implementation state.

Exact Shopify, Meta and CJ connection commands cannot be given yet: there is no application, chosen app setup, callback endpoint, API version or tested adapter. The next coding task must document these after implementing them. No fabricated endpoints or fake live status.

## Foundation update — 2026-10-06

`src/lib/integrations/types.ts` defines source records, cursors and explicitly declared capabilities. The unavailable adapter throws instead of generating fake records. Real Shopify/Meta/CJ adapters remain unimplemented and untested. Local manual invoice uploads and attachment downloads passed browser validation; no external AI/OCR provider is connected.

External PostgreSQL can be configured through DATABASE_URL; demo uses persistent PGlite. No external database credentials were available for validating that adapter. Supabase Auth is not implemented; private Supabase Storage is now implemented but externally untested. See LIVE_SETUP.md; authentication is server-managed sessions with scrypt password hashes. Private durable file storage is required before live uploads.
