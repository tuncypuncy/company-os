# Data dictionary

The tables in db/migrations/001_foundation.sql and 002_organization.sql are implemented in the isolated company_os schema and validated with PostgreSQL/PGlite. The family list below also includes future refinements; it is not a claim every named conceptual table exists. Foreign-key mappings cannot be inferred from country or labels.

## Common fields

| Field/concept | Meaning |
| --- | --- |
| id / external_id | Internal identity / source identity, scoped by integration and external account |
| legal_entity_id, brand_id, store_id | Explicit attribution; unknown mappings surfaced for review |
| amount, currency | Exact original monetary value and currency; explicit precision/rounding |
| source / source_record_id | Platform/manual/import origin and drill-down evidence |
| verification_status | CONFIRMED, RECONCILED, ESTIMATED, PLATFORM_REPORTED, or DEMO; exact schema to finalize |
| ingestion_method | API, webhook, import, or MANUAL; independent of verification |
| freshness_status | LIVE, STALE, UNAVAILABLE, with timestamps; LIVE is not proof of reconciliation |
| mapping_status | MAPPED or UNMAPPED, independent of data freshness |
| source_observed_at / last_synced_at | When source measured the value / when ingestion succeeded |
| created_at, updated_at, created_by | Record creation/change metadata |
| manual_override, override_reason | Explicit override indicator and explanation; retain previous values |
| effective_start/end / version | Historical rule/mapping interval and revision |
| as_of / reporting_timezone | Metric reference timestamp and configured reporting boundary |
| fx_rate/source/time, converted_amount, reporting_currency | Auditable conversion; original value retained |

Source, verification, freshness, lifecycle, and mapping are different dimensions. A manual record can be confirmed but stale. An API record can be live but unreconciled. Do not collapse these meanings into a misleading single status.

## Proposed record families

| Family | Records and essential relationships |
| --- | --- |
| Organization | legal_entities, brands, stores, sales_channels; effective-dated attribution; account/processor mappings |
| Catalog | products, product_aliases, variants, bundle_components; store-scoped external identities and physical component quantities |
| Suppliers | suppliers, supplier_products, supplier_skus, sku_mappings; external/internal SKU equivalences and review status |
| Inventory | warehouses, inventory_snapshots, inventory_adjustments; supplier/SKU/warehouse quantity states, observations and evidence |
| Supply chain | purchase_orders/items, inbound_shipments/items/events; quantity, origin/destination, production/shipping state, ETD/ETA/actual arrival, costs/payments |
| Commerce | shopify_orders (or channel-neutral orders), order_items; source amounts, store, quantity, SKU, country, statuses and source timestamps |
| Refunds | refunds; platform and internal amounts, order relation, restock/recovered cost/fee impacts and methodology version |
| Costs | cost_rules, order_costs, cost_reconciliations; effective rule versions, component estimates, invoice actuals, variance and allocation |
| Prepaid | prepaid_cost_pools, prepaid_consumption; purchased quantities/value, eligibility, consumed quantities, balance and linked payments |
| Ads | ad_platforms, ad_accounts, ad_spend, ad_budgets; actual historical spend versus current/planned budgets |
| Meta billing | meta_billing_accounts, meta_credit_snapshots, meta_invoices, meta_payments; shared facility identity, credit, debt, invoices and separate clearing lifecycle |
| AP and expenses | vendors, expenses, recurring_expenses/subscriptions, invoices/items/attachments; original evidence, category, dates, allocations, payment linkage |
| Payroll (owner extension) | employees/access-limited payroll records, payroll_runs/items, payroll_obligations; gross/net, deductions, employer costs, periods and remittances |
| Taxes (owner extension) | tax_obligations, tax_payments; responsible entity/person, jurisdiction/type/period, filing/payment deadlines, amounts, evidence and status |
| Owners (owner extension) | owner_obligations, owner_distributions; personal versus entity scope, draw/dividend/distribution/salary classification, approvals and withholding where configured |
| Cash | cash_accounts, cash_balance_snapshots, scheduled_payments, expected_inflows; available/pending amounts, due/expected/actual settlement dates and source obligation links |
| Reporting | fx_rates, versioned scenario inputs/results and calculation provenance; explicit assumptions and currency |
| Operations | alerts, integration_connections, integration_syncs, audit_logs; thresholds, affected objects, cursors/errors, actors and revisions |

Prefer canonical invoices/payments with Meta-specific extensions if that avoids duplicate liabilities. Invoice, expense, PO, payroll/tax obligation and scheduled payment links must prevent multiple counting of the same event. Attachment access and payroll/owner details require authorization beyond UI hiding.

## Metrics

| Metric | Definition / caution |
| --- | --- |
| Gross revenue | Source sales before selected discounts/refunds; shipping/tax inclusion requires an explicit policy |
| Net revenue | Gross minus discounts and selected true refunds; do not re-subtract platform-netted amounts |
| True refund | Selected internal refund treatment, preserving platform values |
| True COGS | Product + packaging + fulfillment + shipping + applicable variable costs, one deduction per component |
| Cost variance | Actual reconciled cost minus preserved estimate |
| Contribution profit | Net revenue minus true COGS, ads, processing and remaining variable costs |
| Contribution margin | Contribution profit / net revenue; undefined at zero revenue |
| Available cash | Usable reported balance per entity/account/currency and as-of timestamp |
| Cash required | Gross cash outflows due within a specified rolling horizon |
| Projected ending cash | Opening available cash + expected inflows - outgoing cash |
| Cash surplus/shortfall | Projected ending cash minus configured safety buffer |
| Additional funding needed | max(0, safety buffer - projected ending cash) |
| Meta available credit | Credit limit less outstanding debt, reconciled to facility adjustments/reporting |
| Meta utilization | Outstanding / positive credit limit |
| Meta headroom | Approximate available credit / forecast daily spend; no finite exhaustion at nonpositive spend |
| Available inventory | Source-supported sellable physical stock per SKU/warehouse, not inbound stock |
| Sales/unit velocity | Observed units/day over disclosed 1/3/7/14/30D window; convert bundles through BOM |
| Forecast velocity | Estimated demand with disclosed growth/spend/product-mix assumptions |
| Days of stock | Available sellable units / forecast physical demand; unknown/zero cases explicit |
| Projected stockout | Timeline estimate using physical demand and supported dated inbound availability |
| Inbound inventory | Expected physical units not yet available; quantity, ETA, destination and source status |
| Scale risk | Separate cash, Meta credit, profitability and inventory risk; missing inputs must be visible |

Further formulas and boundary behavior are governed by FINANCIAL_RULES.md. Daily/weekly/monthly COGS aggregates and COGS/revenue ratios must preserve source coverage, date policy and currency assumptions.

## Implemented V0.1 mappings

`obligations` is the canonical scheduled cash liability, with optional unique invoice_id, category, scope, filing_date, period, jurisdiction and paid_at. Detailed tax_obligations/payroll_runs/owner_distributions are not separate tables yet. `orders` is channel-neutral; source IDs are unique per store. `invoice_items.quantity` is the count of priced bundles, while `order_items.quantity` is physical units. Components are bundle prices in minor units. `company_os.users` and sessions are server-only; token hashes, expiry and roles never enter workspace JSON. Financial triggers append before/after values with actor IDs to audit_logs.

Migration 002 seeds only confirmed organizational names and themes. Domains, legal ownership mappings, tax classification, account data and costs stay unconfigured. Demo seed data is separate and runs only in demo mode. Supplier/warehouse/BOM/prepaid/reconciliation/FX/alerts tables exist but their operational UI and engines are incomplete.

Attachment storage: `invoice_attachments.storage_provider` is local or supabase; `storage_bucket` is required for Supabase and null for local. Existing attachments default to local in migration 003. Storage keys are immutable UUIDs, and downloads require an authenticated application session.

Migrations 004–006 add expense recognition, recurring occurrence links, payroll/owner records, effective store ownership history, private pool eligibility/components, reconciliation revisions, immutable current cost snapshots, warehouse/variant/inbound extensions, saved scenarios, provider config metadata, raw source records and idempotent webhook events. Read the migration SQL for exact constraints. `integration_connections.config` is validated nonsecret metadata; actual tokens are referenced by server-side environment-variable name only.
