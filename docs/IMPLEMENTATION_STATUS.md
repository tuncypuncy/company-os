# Company OS implementation ledger

Authoritative backlog: MASTER_SPECIFICATION_V2.md plus the owner's later instructions. This ledger describes code capabilities, not connected external services.

## Implemented local/manual modules

- Persistent PostgreSQL schema and isolated demo database; private local/Supabase attachment provider metadata.
- Password/session authentication, owner and operations roles, owner account creation/deactivation and session revocation, current-password changes.
- Store/entity/currency dashboard, effective-dated nonlinear bundle COGS with explicit SKU/country/supplier/batch constraints and ambiguity rejection.
- Preserved order cost snapshots, invoice-line actual allocations with revisions and control totals; operating expense recognition separated from cash obligations.
- Manual orders, independently recorded platform/internal refunds, COGS recovery and fee impact; configurable refund selection.
- Prepaid pools, remaining quantities/value, idempotent consumption and replacement of the eligible estimated cost component.
- Recurring contracts, cancellation and price history; dated payment generation without duplicate cash obligations; end-of-month anchors.
- Payroll gross/deductions/employer totals with separate net-pay/remittance liabilities; owner payments and personal/company scope.
- Cash snapshots, expected inflows/received states, risk policy and four rolling forecast horizons.
- Manual Meta credit/budget snapshots, payment stages, headroom and early funding recommendations limited by cash/buffer/clearing inputs.
- Configurable product catalog, commercial/supplier SKUs, mappings, recursive BOM cycle rejection, warehouses and source-supported stock snapshots.
- Physical sales velocity windows, stock coverage, projected stockout, inbound-before-stockout detection and explicit warehouse-routing assumptions.
- Manual inbound shipment stages/history and exactly-once availability receipt; supplier/freight liability linked once.
- In-app cash/credit/stock/unmapped/stale/delayed alerts; combined estimated scale decisions and saved scenario history.
- Owner audit history with source IDs, before/after records and actors; sensitive audit/user credentials never appear in operations reads.

## Integration implementation

Shopify GraphQL catalog/order/refund adapter, nested pagination, raw source retention and signed idempotent webhook queue are implemented. Meta account/spend/ad-set-budget adapter is implemented. Connections store account identities and credential **variable names**, never secret values. Bounded sync and a CLI worker are implemented. External service access remains NOT CONNECTED and unverified.

CJ transport/profile validation supports only a confirmed official inventory endpoint/response profile. Official CJ documentation could not be fetched because of current environment network access; endpoint and availability semantics are deliberately not guessed. Manual CJ-equivalent supplier/SKU/warehouse/inventory/inbound operations work independently.

## Validation so far

Finance, database, operation and provider contract tests run against fictional records. Native PostgreSQL 17 with verified local TLS also passed repeatable migrations, live-mode demo isolation, pg-driver date handling, transaction rollback and actor audits. Browser checks render the real operation records. Neither the native local database nor mock provider contracts prove Supabase/Shopify/Meta/CJ connectivity.

## Additional completed modules

Brand/group/custom-date UTC reporting with currency separation; sourced FX translations; partial payments, rescheduled inflows and outstanding liabilities; purchase/reorder estimates and reviewed inbound creation; alert acknowledgement; order/invoice/cost/payment lineage; local PNG/JPG/text/scanned-PDF proposals with human confirmation; safer fee/refund coverage gates; preserved COGS input snapshots; integration setup guides; recurring scheduling CLI; deployment-only migration URL and runtime permission-group SQL.

## Partial / remaining

External Supabase and provider access still require credentials. CJ additionally requires accessible verified official endpoint/response documentation. Shopify payouts/processor fees, Meta CBO/lifetime budget totals/billing APIs, CJ auth refresh/logistics, bank feeds, password recovery/MFA/SSO and email are not implemented. Tax computation and legal deadlines require confirmed professional inputs. Arbitrary multi-store invoice split allocation, automatic storage orphan reconciliation and high-volume reporting pagination/SQL aggregation remain engineering follow-ups. No automated payments or external purchase/ad actions.

Group reports preserve per-store buffers instead of assuming cross-company transfers. Stock coverage uses known mapped demand; fulfillment routing is never inferred. Live funding/surplus is unavailable until a buffer is configured. Partial payment records settle liabilities but never silently change bank balances.
