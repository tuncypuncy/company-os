# Financial and operational calculation rules

These are required managerial methodologies, not configured statutory/tax treatment. The V0.1 engine implements a scoped subset; see the implementation boundary below. Actual rates, mappings, supplier prices, terms, thresholds, and accounting elections remain configurable or TO BE CONFIRMED. Numerical examples in source briefs are not real business values.

## Common controls

Use exact decimal/minor-unit money arithmetic with explicit currency precision and rounding policy; do not use binary floating-point for ledger amounts. Preserve original currency/amount and FX rate/source/time/reporting currency for conversions. Missing FX prevents a reliable consolidated total. Reporting timezone and date boundaries must be explicit; 24h horizons are rolling durations, not silently calendar-day totals.

Keep raw/platform values, manual adjustments, estimates, reconciled actuals, and revisions distinct. Every aggregate needs drill-down to source records and calculation/rule version. Unknown inputs must show missing coverage rather than becoming zero. Demo data must remain isolated from real reporting.

## True COGS

Match effective-dated rules using relevant product, SKU, variant, quantity/bundle quantity, store, supplier, entity, optional country, and optional batch. Store product cost, packaging, fulfillment, shipping, other variable costs, currency, effective interval, source/status, and notes. Country applies only through an explicit cost rule.

A negotiated two-unit bundle price need not equal twice a one-unit price. Rule precedence and overlapping intervals must be explicit; ambiguous or missing matches block a confirmed result. Store the matched rule version and component breakdown with each order calculation. New prices never rewrite old orders. Corrections require versioned recalculation/reconciliation with an audit trail.

Preserve estimated cost, actual invoice allocation, variance (actual minus estimate), reconciliation source/status, and override history. Invoices covering multiple orders/SKUs/stores require explicit allocation with control totals; reject duplicate posting and unexplained over-allocation.

## Supplier invoice / screenshot workflow

1. Upload PDF, JPG, or PNG and retain the original private attachment.
2. Select date, legal entity, and store; distinguish invoice date, cost effective date/period, due date, and payment date.
3. Extract or manually enter vendor, invoice number, currency, totals, taxes, items, SKU/product, quantity, bundle/unit price, shipping, packaging, and other charges.
4. Human review corrects extraction and resolves product/supplier mappings. Split company/store allocations explicitly when needed.
5. Confirm before posting; reconcile line totals to invoice totals and retain review evidence.
6. Create reviewed effective-dated rules or reconcile order estimates according to the selected allocation. Never retroactively replace every historical price from one invoice.

AI output is a proposal, never an authoritative financial posting.

## Prepaid pools and inventory purchases

Economic unit cost = allocated prepaid cost / purchased usable quantity, only with validated quantities and allocation. Consume eligible quantities per order/BOM and track remaining quantity/value and depletion assumptions. Do not silently consume unavailable pool balances or duplicate packaging costs already in COGS.

Cash leaves on the actual payment schedule; P&L cost is allocated to consumption under the configured managerial policy. Inventory purchases and freight may be paid before sales. Purchase, invoice, payment, and order cost can describe the same economics and must not each become an additional expense.

## Refunds

Preserve platform refund and internal/true refund independently: original order, refund event/date, amount/currency, reason, restock state, recovered COGS amount, fee impact, notes, source, and override reason. Internal methodology is TO BE CONFIRMED. Never presume that a refund restores inventory, recovers COGS, or returns processor fees. Do not subtract refunds again from source revenue already net of refunds.

## Profitability

```text
Net revenue = gross revenue - discounts - selected true refunds
True order COGS = product + packaging + fulfillment + shipping + applicable variable costs
Contribution profit = net revenue - true order COGS - processing fees - advertising
                      - other variable costs not already included above
Contribution margin = contribution profit / net revenue
Managerial operating profit = contribution profit - operating expenses not already included
```

Each cost component is deducted exactly once. Gross revenue's shipping revenue and tax treatment must be explicitly configured and documented before confirmed reporting. Margin at zero revenue is undefined, not a fabricated percentage. Separate expense recognition from cash payments, and personal owner obligations from company P&L. Managerial profit is not statutory profit by default.

## All costs, subscriptions, payroll, taxes, and owners

Cover advertising, supplier/inventory, freight, fulfillment, shipping, payroll, freelancers, agencies, accounting, office, Amazon, SaaS, Shopify apps, and custom categories. Vendors are editable; examples such as ElevenLabs/Higgsfield are not confirmed active subscriptions or prices.

Track recurring contracts: vendor/app, entity, brand/store allocation, amount/currency, billing frequency, effective dates, next charge/renewal, price history, status/cancellation, source and last verified. Updated invoices/imports or authorized integrations maintain current costs; unsupported automatic refresh must not be claimed.

Payroll should distinguish gross/net salary, employee deductions, employer taxes/contributions, benefits, period, payday, and remittance dates. Salary payment and tax remittance are separate cash events; deductions are not added again as employer expense.

Tax obligations support VAT/sales tax, company income taxes, payroll taxes and other confirmed liabilities: responsible entity, jurisdiction, registration, tax type, period, amount/currency, filing deadline, payment deadline, status, evidence, and payments. Track refunds/credits separately. Never invent registrations, nexus, liability amounts, rates, deductibility, recoverable VAT, deadlines, or LLC classification. Only explicitly entered/imported obligations enter the forecast; estimates must be clearly labeled.

Owner records distinguish personal tax obligations, company-paid obligations, salary, draws, distributions, dividends, and any declared withholding. Track approval/declaration, period, recipient, due/payment dates, status and source. Do not assume LLC distributions are dividends. Personal taxes do not enter company expense/cash forecasts unless explicitly linked to a company-funded cash event with configured treatment.

## Cash forecast

Forecast 24h, 48h, 72h and 7d from an explicit as-of timestamp, per entity/currency and optionally consolidated with disclosed FX.

```text
Projected ending cash = current available cash + expected inflows - scheduled cash outflows
Cash surplus/shortfall = projected ending cash - configured safety buffer
Cash required = scheduled outgoing cash within the horizon
Additional funding needed = max(0, safety buffer - projected ending cash)
```

Show gross outflows and additional funding needed separately. Opening balance needs source/as-of freshness; pending/restricted cash is not automatically available. Expected revenue is not immediate cash: use actual/configured Shopify/processor/Amazon settlement timing, holds, and fees. Do not reuse stale balances as current confirmed cash.

Include dated supplier/inventory/freight invoices, recurring expenses, payroll, entered taxes, owner/company payments where applicable, and other obligations. Deduplicate linked invoices/expenses/POs/scheduled payments and actual settlements. A paid obligation must not remain forecast as unpaid.

Ad spend accrues economic cost; credit-billed Meta cash leaves on the payment schedule. Forecast credit consumption separately; do not add daily spend and payment of the same billed spend as two cash outflows. Prepaid/debited accounts use their actual funding terms. Unknown payment terms remain an explicit forecast limitation.

## Meta credit

Available credit = credit limit - outstanding balance, subject to actual reported facility adjustments. Utilization = outstanding / limit for a valid positive limit. Approximate days of headroom = available credit / forecast daily spend, with balance freshness and spend-window assumptions shown. Nonpositive spend has no finite exhaustion forecast; zero/unknown limits are not valid utilization denominators.

Distinguish PLANNED, INITIATED, SENT, RECEIVED, and CREDIT_RESTORED. Do not restore credit from payment initiation alone. Forecast exhaustion versus due dates and clearing delay. Early payment suggestions must account for available cash, buffer, other obligations, and expected clearing; missing inputs prevent a confident recommendation. Never initiate payments automatically. Credit thresholds (including 3/2/1 days) are configurable.

## Inventory and supply chain

Calculate physical demand from order quantities and BOM components, independent of supplier bundle economics. Support 1D and 3/7/14/30-day velocity; show chosen window, observed coverage, weighting and forecast assumptions.

Days of stock ≈ available sellable units / expected daily unit demand. Unknown demand is not zero; zero demand does not yield a finite stockout date. Do not derive available/reserved/inbound states unsupported by the API. Avoid subtracting reservations twice from already-available stock.

Stockout forecasting uses timestamped warehouse/SKU stock, forecast demand, confirmed inbound quantity/ETA and eventual availability. Evaluate coverage before each inbound arrival; inbound is not current available stock. Include delay/customs/production only with actual data. Risk thresholds (14/7/5/3 days examples) are configurable.

Reorder recommendations may use lead times, safety stock, MOQ, current/inbound stock, growth, prices, freight, and cash. Missing lead time or supplier terms limit confidence. Recommendations only; never place orders automatically. Link reorder payments to cash obligations without duplicate posting.

## Scaling scenarios and alerts

Compare baseline and proposed Meta/Google spend using disclosed ROAS/revenue, product mix, true COGS, refunds, fees, settlement delay, credit clearing, and safety-buffer assumptions. Report incremental 24h/48h/72h/7d outflows/funding, expected revenue/contribution profit, Meta consumption/headroom, order/unit velocity, BOM consumption, coverage/stockout, and inbound risks. Scenario values are ESTIMATED and do not mutate actual records.

Present separate financial/cash, Meta credit, and inventory risks with explanations; do not declare safe scaling when material inputs are missing. Alerts cover credit, cash shortfall, due/overdue obligations, unexpected expense, COGS/refund changes, low prepaid/stock, inbound delay/stockout, unmapped SKUs, and failed/stale syncs. Include severity, affected object, reason, timestamp and suggested action. Start with in-app notifications.

## Implemented boundary — 2026-10-06

Amounts use safe integer minor units for USD/EUR/GBP. Effective rules match canonical product/store/entity/bundle/currency and optional SKU/country/supplier/batch, preferring unique greatest specificity; ties fail closed. Exclusive ends preserve history. Saved estimates include rule version, components and input snapshot. Reconciliation revisions preserve estimates and enforce invoice allocation control totals.

Prepaid cumulative integer allocation exhausts exactly. Consumption replaces the selected estimated component; complete reconciled actual totals remain authoritative and must include the appropriate prepaid treatment. Reviewed refunds preserve platform evidence, use idempotent event identities, retain override audit history, and cap recovery at recorded order cost. Imported platform cash refunds require reviewed net basis; unavailable processing fees/ad coverage/costs block definitive profit.

Cash includes remaining company liabilities after partial payments, overdue obligations and dated expected inflows once each. Payments do not automatically change bank snapshots. No cross-company transfers or cross-currency netting are inferred. Live buffer/funding surplus is unavailable until an explicit buffer exists. Original currencies remain separate; direct sourced FX conversions show rate/time and remain unavailable for missing rates.

Meta credit links its own account budget, requires reviewed credit/clearing snapshots, and never treats API spend cap as a credit facility. Incomplete ad-set budget coverage is not published as zero. Combined scale decisions remain estimates; missing supplier cash timing, fresh data or confirmed fulfillment routing blocks a supported scale verdict. Stock snapshots remain physical; shared stock is not silently reserved for one store.

Payroll, owner distributions, tax amounts and filing/payment dates are reviewed manual records, not computed legal advice. Local document extraction produces UNREVIEWED proposals; original files are private and confirmation is mandatory. No automatic bank/ad/supplier action occurs.

## Autonomous expansion

Preserved `order_costs` now take precedence over recalculated rules, with actual invoice allocations overriding preserved estimates. Actual allocation revisions retain original estimates and reject invoice-line over-allocation. Prepaid consumption replaces its selected estimated component; it does not add the component twice or overwrite reconciled invoice totals. Remaining monetary value uses cumulative rounded consumption so the pool exhausts exactly. Recurring charge generation creates a unique liability/expense pair per occurrence; price revisions do not rewrite existing scheduled liabilities. Payroll economic cost is gross plus employer contributions, while cash is net pay plus deductions/employer remittance. Platform refund is the default selection until `INTERNAL_REVIEWED` is configured; platform and review records remain separate. Stock snapshots do not infer country-based demand routing.
