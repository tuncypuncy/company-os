# COMPANY OS — MASTER SPECIFICATION V2
# BUSINESS CONTEXT + FINANCE + CASH + INVENTORY + SUPPLY CHAIN
#
# IMPORTANT:
# This document supersedes previous Company OS prompts where they conflict.
# Treat this as the current authoritative project brief.

============================================================
0. CORE MISSION
============================================================

Build an internal application called COMPANY OS.

Company OS is the financial and operational control tower for a real,
high-volume, multi-entity e-commerce business.

This is NOT:

- a generic Shopify dashboard
- a generic expense tracker
- a bookkeeping toy
- a Triple Whale clone
- a demo ERP

It should eventually combine:

COMMERCE
ADVERTISING
TRUE COGS
REFUNDS
CASH
EXPENSES
ACCOUNTS PAYABLE
META BILLING
INVENTORY
SUPPLY CHAIN
FORECASTING
SCALING DECISIONS
AI BUSINESS INTELLIGENCE

into one internal operating system.

The core question Company OS should answer is:

"What is actually happening in the company right now,
what will happen next,
and what action should we take?"

============================================================
1. ABSOLUTE DATA PRINCIPLES
============================================================

NEVER INVENT BUSINESS FACTS.

Never invent:

- cash balances
- COGS
- supplier prices
- inventory
- invoices
- Meta credit limits
- payment terms
- tax liabilities
- legal entity mappings
- store mappings
- bank balances
- settlement schedules
- supplier lead times
- warehouse inventory
- API capabilities
- refund treatment

If information is unknown:

1. make it configurable,
2. mark it unknown,
3. use explicitly labeled DEMO data,
4. or request confirmation when necessary.

Every important data point should have a status/source.

Support statuses such as:

LIVE
CONFIRMED
RECONCILED
ESTIMATED
MANUAL
PLATFORM_REPORTED
DEMO
STALE
UNAVAILABLE

Never make DEMO data look live.

Never make estimated financial data look reconciled.

============================================================
2. LEGAL ENTITIES
============================================================

There are currently TWO primary legal entities.

------------------------------------------------------------
OMURTAK B.V.
------------------------------------------------------------

Legal name:
Omurtak B.V.

Jurisdiction:
Netherlands

Entity type:
Dutch B.V.

This is an established international e-commerce operating company.

It sells internationally.

It should NOT be modeled as a Netherlands-only commerce business.

EUR is an important operating/accounting currency.

Transactions can occur in multiple currencies.

------------------------------------------------------------
SOFTDANCE LLC
------------------------------------------------------------

Legal name:
Softdance LLC

Jurisdiction:
Wyoming, United States

Entity type:
US LLC.

Softdance LLC is separate from Omurtak B.V.

It has US banking infrastructure.

USD is an important operating currency.

------------------------------------------------------------
IMPORTANT ENTITY RULE
------------------------------------------------------------

CUSTOMER COUNTRY DOES NOT DETERMINE LEGAL ENTITY.

Legal entity attribution must come from actual:

store
payment account
sales channel
bank
ad account
or explicit configuration mappings.

The owner currently lives outside the Netherlands.

Owner residence and company jurisdiction are separate concepts.

Never model these businesses as Turkish companies simply because the owner
may operate from Turkey.

============================================================
3. ORGANIZATIONAL DATA MODEL
============================================================

Conceptually support:

LEGAL ENTITY
    ↓
BRAND
    ↓
STORE
    ↓
SALES CHANNEL
    ↓
ORDER
    ↓
PRODUCT / SKU

But do NOT create rigid one-to-one assumptions.

Also support independent relationships for:

AD ACCOUNT
BANK ACCOUNT
PAYMENT PROCESSOR
SUPPLIER
WAREHOUSE
VENDOR
EXPENSE
INVOICE
INVENTORY
SHIPMENT

A brand may have multiple stores.

A store may sell globally.

A product may exist across multiple stores.

A supplier SKU may differ from a Shopify SKU.

A product may exist in multiple warehouses.

============================================================
4. CURRENT ACTIVE BRANDS
============================================================

ONLY actively implement these businesses now:

1. GODISABOVE
2. 360 FAUCET

The architecture must support adding more brands later.

DO NOT currently build active integrations for other historical/future brands.

============================================================
5. GODISABOVE
============================================================

Godisabove is currently the primary business being modeled.

It is a Christian / faith-based consumer products brand.

It is an established, high-volume direct-to-consumer business.

Do NOT treat it as a new test store.

Important commercial systems include:

Shopify
Amazon
Meta Ads
Google Ads
Triple Whale
CJ / supplier and fulfillment systems

============================================================
6. GODISABOVE STORES
============================================================

There are two important Godisabove storefronts.

Use operational labels:

GODISABOVE

GODISABOVE USA

Known domains include:

godisabove.com
godisabove-us.com

IMPORTANT:

"USA" IS ONLY AN OPERATIONAL STORE LABEL.

It DOES NOT mean that store only sells to the United States.

Both stores sell internationally.

Both stores have broadly similar geographic customer mixes.

The United States represents the majority of customers.

Other markets include:

Canada
Australia
United Kingdom
and many other countries.

Therefore:

NEVER infer store from customer country.

NEVER infer legal entity from customer country.

Geography is primarily an analytics dimension unless an explicit business
rule says otherwise.

============================================================
7. GODISABOVE PRODUCT CATALOG
============================================================

The catalog changes.

DO NOT hard-code the product catalog into application logic.

Shopify should eventually become a major source for current catalog data.

Support canonical product names plus aliases.

Known/current important products include:

------------------------------------------------------------
BIBLE VERSE JAR
------------------------------------------------------------

Hero product.

Possible internal names:

Jar
Bible Jar
Bible Verse Jar
Scripture Jar

Aliases should map to one canonical product.

------------------------------------------------------------
BIBLE TRIVIA
------------------------------------------------------------

Faith-based / Bible learning family product.

Currently actively sold.

------------------------------------------------------------
WOMEN'S CARDS
------------------------------------------------------------

Faith-oriented card product.

Currently actively sold.

------------------------------------------------------------
OTHER PRODUCTS
------------------------------------------------------------

Additional/new products are expected.

Historically or additionally the brand has worked with products such as:

Bible Projector
Verse Discs
Christian gifting products
kids/family faith products

Do NOT automatically assume every historical product is currently active.

Shopify/current configuration should determine active catalog state.

When Shopify discovers a new SKU:

import it

mark it UNMAPPED where necessary

allow finance/operations to configure:

supplier
COGS
inventory mapping
product aliases

without changing application code.

============================================================
8. 360 FAUCET
============================================================

360 Faucet is a separate business/brand.

Treat it independently from Godisabove.

It should eventually have its own:

orders
revenue
products
COGS
advertising
expenses
inventory
profitability
cash attribution

where applicable.

DO NOT create a brand called:

360 FlowSets

The current relevant business is:

360 Faucet.

============================================================
9. FUTURE BRANDS
============================================================

Additional brands may be connected later.

Design Company OS so adding another brand/store does NOT require rebuilding
the financial architecture.

But do not create active integrations for them now.

============================================================
10. WHY COMPANY OS EXISTS
============================================================

Current information exists across systems such as:

Shopify
Triple Whale
Meta
Google
Amazon
CJ
supplier invoices
bank accounts
spreadsheets
manual operational records

No single platform represents the complete truth.

The major problem is:

PLATFORM ECONOMICS != REAL ECONOMICS.

Company OS should become the company's internal operational source of truth.

============================================================
11. TRIPLE WHALE
============================================================

Triple Whale is used for:

analytics
attribution
performance monitoring

It remains useful.

Company OS does NOT need to replace Triple Whale.

Where useful, ingest Triple Whale data.

But:

Triple Whale COGS is NOT authoritative.

Triple Whale refund treatment is NOT automatically authoritative.

Triple Whale profit is NOT automatically authoritative.

Preserve platform-reported values separately.

Eventually Company OS should answer:

"Why does Company OS profit differ from Triple Whale?"

============================================================
12. TRUE COGS ENGINE — CRITICAL
============================================================

This is one of the most important parts of the application.

Supplier economics are NOT necessarily linear.

Example:

1 unit might cost $4.

That DOES NOT mean:

2 units = $8.

Actual supplier pricing might be:

1 unit = $4.00
2 units = $5.50
3 units = another negotiated price.

Therefore:

quantity × unit cost

is NOT sufficient.

Support cost rules based on:

product
SKU
variant
quantity
bundle quantity
store
supplier
legal entity
country if relevant
effective date
supplier batch if relevant

A cost rule may contain:

product cost
packaging
fulfillment
shipping
other variable cost
currency
effective start
effective end
source
status
notes

============================================================
13. HISTORICAL COGS
============================================================

Supplier pricing changes.

Historical economics must remain historically correct.

Use effective-dated rules.

Example:

Jan-Aug:
2-pack = $5.50

Sep-Oct:
2-pack = $5.20

Nov onward:
2-pack = $4.85

An order from July must continue using the July economics.

Never overwrite historical cost logic when current supplier pricing changes.

============================================================
14. ESTIMATED VS ACTUAL COGS
============================================================

Initially an order may use:

ESTIMATED COGS.

Later a supplier invoice may provide:

ACTUAL COGS.

Preserve both.

Support:

estimated cost
actual cost
variance
reconciliation status
reconciliation source

Never silently destroy the estimate.

============================================================
15. REFUNDS
============================================================

Shopify/platform refunds may differ from internal economic treatment.

Preserve:

PLATFORM REFUND

and

TRUE / INTERNAL REFUND

separately.

Possible fields:

original order
platform refund
internal refund
refund date
reason
restocked
COGS recovered
payment fee impact
notes
source

Profitability should use the configured internal methodology.

============================================================
16. PREPAID COST POOLS
============================================================

Some costs are paid upfront but economically consumed across future orders.

A known example is a prepaid cart/packaging-related cost used across eligible
orders.

Support:

prepaid pool
purchase date
quantity purchased
total cash paid
economic unit cost
remaining quantity
eligible stores
eligible products/orders
consumption
remaining value
estimated depletion

VERY IMPORTANT:

CASH IMPACT

and

ECONOMIC COST

must remain separate.

A $100,000 prepaid purchase may create:

$100,000 cash outflow today

but economic cost may be allocated across future orders.

============================================================
17. CASH != PROFIT
============================================================

Never confuse:

CASH FLOW

with

PROFITABILITY.

Company OS should display both.

This distinction applies especially to:

inventory purchases
prepaid materials
supplier payments
Meta invoice timing
settlements

============================================================
18. CJ / SUPPLIER / FULFILLMENT INTEGRATION
============================================================

CJ is an IMPORTANT integration.

Create a dedicated integration architecture for CJ / supplier systems.

Where the real CJ API supports the required information, ingest:

products
supplier SKUs
warehouse inventory
inventory availability
order fulfillment information
supplier orders
purchase information
shipment/tracking information
warehouse information

DO NOT invent CJ API endpoints.

Inspect the real API documentation when implementing.

If a required data point is not available:

mark it unavailable

or create a manual/import fallback.

============================================================
19. SKU MAPPING
============================================================

Create a robust mapping layer:

SHOPIFY PRODUCT
→ SHOPIFY VARIANT
→ SHOPIFY SKU
→ INTERNAL PRODUCT
→ SUPPLIER
→ SUPPLIER SKU
→ WAREHOUSE INVENTORY

Do NOT assume Shopify SKU always equals CJ/supplier SKU.

Operations must be able to manually map unmatched SKUs.

Create an:

UNMAPPED SKUS

workflow.

============================================================
20. INVENTORY CONTROL TOWER
============================================================

Create an Inventory section.

Track inventory by:

brand
product
SKU
supplier
warehouse
country/location
status

Where available distinguish:

AVAILABLE
RESERVED
PROCESSING
INBOUND
ON HAND
UNAVAILABLE

Never fabricate these distinctions if the supplier API does not expose them.

============================================================
21. US WAREHOUSE INVENTORY
============================================================

US warehouse inventory is especially operationally important.

Company OS should make it easy to see:

US AVAILABLE STOCK

for each important product.

Example UI:

BIBLE VERSE JAR

US Available:
18,420

China Available:
42,100

Inbound to US:
30,000

Recent Sales Velocity:
3,120/day

Estimated US Days of Stock:
5.9 days

These numbers are EXAMPLES ONLY.

Do not store them as real business data.

============================================================
22. STOCK VELOCITY
============================================================

Calculate sales velocity using real order data.

Support:

1-day velocity
3-day average
7-day average
14-day average
30-day average

For rapidly scaling products, recent weighted velocity may be more useful
than simple long-term average.

Make methodology visible/configurable.

============================================================
23. DAYS OF STOCK
============================================================

Calculate:

DAYS OF STOCK

approximately as:

available sellable inventory
/
expected daily unit demand

But do not oversimplify bundles.

If an order for a 2-pack consumes two physical units:

inventory consumption must equal two units.

If bundle composition is more complex:

use a bundle/BOM mapping.

============================================================
24. BUNDLE / BOM SUPPORT
============================================================

Support Bills of Materials / bundle composition.

Example:

A customer-facing bundle may consume:

2 × Jar
1 × Gift Box
3 × Sticker
etc.

Inventory consumption should be based on physical components.

Do not assume:

1 Shopify line item = 1 physical inventory unit.

============================================================
25. STOCKOUT FORECASTING
============================================================

For each important SKU calculate:

CURRENT INVENTORY

RECENT VELOCITY

FORECAST VELOCITY

DAYS OF STOCK

PROJECTED STOCKOUT DATE

INBOUND INVENTORY

INBOUND ETA

EXPECTED INVENTORY AT ARRIVAL

STOCKOUT RISK

Possible statuses:

HEALTHY
WATCH
HIGH RISK
CRITICAL

============================================================
26. INBOUND INVENTORY
============================================================

Track inbound inventory.

Fields may include:

supplier
product
SKU
quantity
origin warehouse
destination warehouse
order date
production status
shipment status
tracking
carrier
ETD
ETA
actual arrival
cost
payment status

Where CJ exposes these values:

sync them.

Otherwise:

support manual updates/import.

============================================================
27. SUPPLY CHAIN TIMELINE
============================================================

Create a visual supply chain timeline.

Example:

PURCHASE ORDER
→ PRODUCTION
→ READY
→ SHIPPED
→ IN TRANSIT
→ CUSTOMS
→ WAREHOUSE
→ AVAILABLE

Only show statuses supported by actual data.

============================================================
28. INVENTORY ALERTS
============================================================

Support alerts such as:

< 14 days stock
< 7 days stock
< 5 days stock
< 3 days stock

Inbound delayed

Projected stockout before inbound arrival

Unexpected inventory discrepancy

High sales velocity

Unmapped supplier SKU

Inventory sync failed

Thresholds should be configurable.

============================================================
29. INVENTORY + ADVERTISING
============================================================

THIS IS A VERY IMPORTANT FEATURE.

Advertising scale affects unit demand.

Therefore inventory forecasting must interact with advertising forecasting.

Example:

Current Meta:
$40,000/day

Proposed Meta:
$70,000/day

Company OS should estimate:

new order velocity
new unit velocity
new days of stock
new projected stockout date

using clearly visible assumptions.

============================================================
30. INVENTORY + CASH
============================================================

Inventory decisions also affect cash.

Company OS should eventually model:

current inventory
forecast demand
inbound inventory
required reorder quantity
supplier payment
payment date
shipping/freight
expected arrival

and include upcoming supplier payments in the cash forecast.

============================================================
31. REORDER ENGINE
============================================================

Eventually calculate suggested reorder timing.

Potential inputs:

current inventory
sales velocity
forecast growth
supplier lead time
production lead time
shipping lead time
safety stock
inbound inventory
minimum order quantity
supplier pricing
cash position

Potential output:

REORDER RECOMMENDED

Suggested quantity:
X

Recommended order date:
Y

Expected cash requirement:
Z

Estimated stockout without reorder:
Date

This is recommendation-only.

Never automatically place supplier orders.

============================================================
32. ADVERTISING
============================================================

Important platforms:

META
GOOGLE

Track:

date/time
platform
ad account
brand
store where attributable
legal entity
currency
actual spend
current budget
planned budget

Historical actual spend and planned future spend are separate concepts.

============================================================
33. META — HIGH PRIORITY
============================================================

Meta is a HIGH-PRIORITY integration.

Where API access permits ingest:

actual spend
ad account
campaign/account budget information
account status
relevant billing information

DO NOT fabricate API capabilities.

If Meta does not expose a required billing field:

use manual/invoice-based data.

============================================================
34. META BILLING CONTROL
============================================================

Track:

billing account
legal entity
credit limit
outstanding balance
available credit
utilization
invoices
invoice issue date
due date
payment status
payment initiated date
expected clearing date
actual clearing date
current spend
planned spend

============================================================
35. META HEADROOM
============================================================

Calculate estimated remaining credit headroom.

Example:

Available credit:
$100,000

Spend:
$50,000/day

Approximate headroom:
2 days.

If planned spend becomes:

$80,000/day

headroom must immediately change.

============================================================
36. META EARLY PAYMENT RECOMMENDATIONS
============================================================

Recommend early invoice payment when credit exhaustion could interrupt
advertising before invoice maturity.

Example:

HEADROOM:
1.6 days

INVOICE DUE:
5 days

Company OS should identify the mismatch.

Possible recommendation:

"Consider paying $X today to protect advertising continuity."

Always explain the reasoning.

Never automatically move money.

============================================================
37. META PAYMENT CLEARING
============================================================

Distinguish:

PAYMENT PLANNED
PAYMENT INITIATED
PAYMENT SENT
PAYMENT RECEIVED
CREDIT RESTORED

because payment initiation does not necessarily restore advertising credit
immediately.

============================================================
38. EXPENSE MANAGEMENT
============================================================

Centralize expenses.

Example categories/vendors include:

Meta
Google
Shopify
Shopify Apps
ElevenLabs
Higgsfield
agencies
freelancers
suppliers
Amazon
fulfillment
shipping
accounting
office
SaaS

Do not hard-code vendors.

Fields:

vendor
description
legal entity
brand
store
category
amount
currency
transaction date
invoice date
due date
payment date
recurring
recurrence
status
invoice attachment
source
notes

============================================================
39. RECURRING EXPENSES
============================================================

Track recurring obligations.

Company OS should answer:

What payments are due tomorrow?

What is due this week?

What SaaS do we pay monthly?

What does Omurtak B.V. pay?

What does Softdance LLC pay?

============================================================
40. INVOICE CENTER
============================================================

Operations Manager should be able to upload:

PDF
JPG
PNG

Store the original.

AI may extract:

vendor
invoice number
invoice date
due date
amount
currency
entity
category
line items
SKU
quantity
unit price

Workflow:

UPLOAD
→ EXTRACT
→ HUMAN REVIEW
→ CONFIRM
→ POST / RECONCILE

AI extraction is never automatically authoritative.

============================================================
41. CASH ACCOUNTS
============================================================

Support multiple cash/bank accounts.

Track:

entity
account
currency
available balance
pending balance
source
last updated

Manual balances are acceptable initially.

Future bank integrations must be possible.

============================================================
42. MULTI-CURRENCY
============================================================

Support:

USD
EUR
GBP
and additional currencies.

Never silently combine currencies.

For conversion store:

original amount
original currency
FX rate
FX source
FX date/time
converted amount
reporting currency

============================================================
43. CASH CONTROL TOWER — CRITICAL
============================================================

The main system must answer:

HOW MUCH CASH DO WE HAVE NOW?

HOW MUCH CASH IS REQUIRED IN:

24 HOURS
48 HOURS
72 HOURS
7 DAYS

WHAT CASH IS EXPECTED TO ARRIVE?

WHAT CASH MUST LEAVE?

WHAT IS OUR PROJECTED ENDING CASH?

WHAT IS OUR SAFETY BUFFER?

CAN WE SAFELY SCALE?

============================================================
44. CASH REQUIREMENT ENGINE
============================================================

Potential outflows include:

Meta
Google
supplier invoices
inventory orders
freight
fulfillment
shipping
agencies
freelancers
SaaS
Shopify apps
Amazon
payroll
accounting
other scheduled payments

Tax payments should ONLY be included if explicitly entered/imported.

Never invent tax liabilities.

============================================================
45. EXPECTED INFLOWS
============================================================

Eventually support:

Shopify payouts
processor settlements
Amazon settlements
receivables

Do NOT assume:

sales today = cash today.

Settlement timing must be data-driven/configurable.

============================================================
46. CAN WE SCALE? — CRITICAL
============================================================

Create a Scaling Simulator.

User can enter:

CURRENT META SPEND
PROPOSED META SPEND

and optionally other assumptions.

Example:

$30k/day
→
$50k/day

Immediately calculate:

24h additional cash required
48h additional cash required
72h additional cash required
7d additional cash required

expected revenue
expected true COGS
expected contribution profit

Meta credit consumption
Meta headroom

AND NOW ALSO:

expected order velocity
expected unit velocity
inventory consumption
days of stock
projected stockout
inbound inventory risk

============================================================
47. SCALE DECISION ENGINE
============================================================

Eventually produce a decision summary such as:

FINANCIAL CAPACITY:
HEALTHY

META CREDIT:
WATCH

INVENTORY:
HIGH RISK

CASH:
HEALTHY

OVERALL:
SCALE WITH CAUTION

Reason:

"Cash supports the proposed spend, but US Jar inventory is projected to
stock out before the next inbound shipment."

Recommendations must show assumptions.

============================================================
48. TRUE PROFITABILITY
============================================================

Conceptual calculation:

GROSS REVENUE

- DISCOUNTS
- TRUE REFUNDS

= NET REVENUE

- TRUE PRODUCT COGS
- PACKAGING
- FULFILLMENT
- SHIPPING
- PAYMENT PROCESSING
- ADVERTISING
- OTHER VARIABLE COSTS

= CONTRIBUTION PROFIT

Then separately show:

OPERATING EXPENSES

and managerial operating profit where appropriate.

Do NOT represent Company OS managerial profit as statutory accounting profit
unless explicitly configured.

============================================================
49. AMAZON
============================================================

Amazon FBA is part of the broader operation.

Architecture should support:

orders
fees
FBA fees
inventory
settlements
returns
refunds
advertising where relevant

Amazon is NOT the first integration priority.

============================================================
50. USER ROLES
============================================================

Initial roles:

OWNER
OPERATIONS MANAGER

OWNER:

full visibility/control.

OPERATIONS MANAGER:

upload invoices
confirm invoice extraction
manage expenses
record payments
manage suppliers
map SKUs
manage inbound inventory
maintain operational finance data

Future roles:

FINANCE
ACCOUNTANT
READ ONLY

============================================================
51. AUDITABILITY
============================================================

Financial and operational records should track:

created_at
updated_at
created_by
source
external_id
status
manual_override
override_reason

Do not silently destroy historical values.

============================================================
52. DATA LINEAGE
============================================================

Important metrics must be traceable.

Example:

TRUE COGS TODAY

should drill down to:

orders
SKUs
cost rules
supplier invoices
reconciliations
manual overrides

Inventory should drill down to:

supplier
warehouse
SKU
sync
manual adjustments

Cash should drill down to:

accounts
payments
inflows
scheduled obligations

============================================================
53. DATA FRESHNESS
============================================================

Display source and freshness.

Examples:

SHOPIFY
LIVE
2 min ago

META
LIVE
8 min ago

CJ
LIVE
12 min ago

BANK
MANUAL
4 hours ago

COGS
RECONCILED
Oct 5

If a sync becomes stale:

show it.

============================================================
54. ALERT CENTER
============================================================

Support:

META HEADROOM < 3 DAYS
META HEADROOM < 2 DAYS
META HEADROOM < 1 DAY

CASH SHORTFALL

INVOICE DUE
INVOICE OVERDUE

COGS INCREASE

REFUND RATE INCREASE

STOCK < 14 DAYS
STOCK < 7 DAYS
STOCK < 5 DAYS
STOCK < 3 DAYS

PROJECTED STOCKOUT

INBOUND DELAYED

STOCKOUT BEFORE INBOUND

UNMAPPED SKU

CJ SYNC FAILED

SHOPIFY SYNC FAILED

META SYNC FAILED

UNEXPECTED LARGE EXPENSE

Each alert should include:

severity
reason
affected entity
brand
product/account
timestamp
recommended action

============================================================
55. MAIN DASHBOARD
============================================================

Create a premium internal control center.

Desktop-first.

Visual inspiration:

modern fintech
Stripe
Mercury
Triple Whale
Linear

Do not clone any product.

Top-level metrics:

TODAY REVENUE
TODAY AD SPEND
TODAY TRUE COGS
TODAY TRUE REFUNDS
TODAY CONTRIBUTION PROFIT
CONTRIBUTION MARGIN

AVAILABLE CASH

24H CASH REQUIRED
48H CASH REQUIRED
72H CASH REQUIRED
7D CASH REQUIRED

META CREDIT UTILIZATION
META DAYS OF HEADROOM

UPCOMING PAYMENTS

INVENTORY AT RISK
INBOUND INVENTORY

Charts:

Revenue
Contribution Profit
True COGS
Ad Spend
Cash
Margin
Refund Rate
Inventory Coverage

Filters:

Today
Yesterday
7D
30D
MTD
Custom

and:

Group
Legal Entity
Brand
Store
Currency

============================================================
56. INVENTORY DASHBOARD
============================================================

Create dedicated inventory view.

Example columns/cards:

Product
SKU
Warehouse
Available
Inbound
1D Velocity
7D Velocity
Forecast Velocity
Days Stock
Projected Stockout
Next Inbound ETA
Risk

Allow filtering by:

brand
store
supplier
warehouse
country
risk

============================================================
57. SUPPLY CHAIN DASHBOARD
============================================================

Show:

open supplier orders
production
inbound shipments
warehouse destination
ETA
inventory coverage
payments required
risk

Highlight shipments that arrive after projected stockout.

============================================================
58. GROUP VIEW
============================================================

Support:

GROUP

OMURTAK B.V.

SOFTDANCE LLC

and:

ALL BRANDS

GODISABOVE

360 FAUCET

Consolidated views must preserve drill-down.

============================================================
59. COMPANY AI — FUTURE
============================================================

Eventually add a Company AI interface.

The owner should be able to ask:

"How much cash do I need tomorrow?"

"How much cash do I need in 3 days?"

"Can we scale Meta to $80k/day?"

"Why did margin drop?"

"Why does Triple Whale disagree?"

"How many Jars do we have?"

"How much US Jar stock is available?"

"How many days of Jar inventory remain?"

"When will we stock out?"

"What is currently inbound?"

"Will inbound arrive before stockout?"

"What happens to inventory if I scale Meta?"

"How much do I need to reorder?"

"When should I reorder?"

"How much cash will the reorder require?"

"What supplier invoices are due?"

"Should I pay Meta today?"

"What changed since yesterday?"

The AI must query structured company data.

NEVER invent financial or inventory answers.

============================================================
60. DATABASE
============================================================

Design a proper relational schema.

Potential entities:

legal_entities
brands
stores
sales_channels

products
product_aliases
variants
bundle_components

suppliers
supplier_products
supplier_skus

warehouses
inventory_snapshots
inventory_adjustments

purchase_orders
purchase_order_items

inbound_shipments
shipment_items
shipment_events

shopify_orders
order_items

refunds

cost_rules
order_costs
cost_reconciliations

prepaid_cost_pools
prepaid_consumption

ad_platforms
ad_accounts
ad_spend
ad_budgets

meta_billing_accounts
meta_credit_snapshots
meta_invoices
meta_payments

vendors

expenses
recurring_expenses

invoices
invoice_items
invoice_attachments

cash_accounts
cash_balance_snapshots

scheduled_payments
expected_inflows

fx_rates

alerts

integration_connections
integration_syncs

sku_mappings

audit_logs

Modify this if a better normalized design exists.

Use migrations.

============================================================
61. TECH STACK
============================================================

Preferred:

Next.js
TypeScript
PostgreSQL
Supabase
Tailwind CSS
shadcn/ui where useful
Recharts
Vercel-compatible deployment

Use server-side integrations.

Never expose secrets client-side.

Create:

.env.example

Never commit real credentials.

============================================================
62. PERSISTENT CODEX KNOWLEDGE — CRITICAL
============================================================

Create:

/AGENTS.md

This file should tell every future coding agent:

BEFORE modifying Company OS:

1. Read /docs/BUSINESS_CONTEXT.md
2. Read /docs/FINANCIAL_RULES.md
3. Read /docs/ENTITY_MAP.md
4. Read /docs/PRODUCT_CATALOG.md
5. Read /docs/INTEGRATIONS.md
6. Read /docs/DECISIONS.md when architectural context matters.

Never invent financial/business values.

Never overwrite historical financial data without explicit logic.

Use source/status labels.

Update documentation when confirmed business rules change.

============================================================
63. BUSINESS_CONTEXT.md
============================================================

Create:

/docs/BUSINESS_CONTEXT.md

Store confirmed context including:

Omurtak B.V.
Softdance LLC
Godisabove
Godisabove stores
global nature of both stores
360 Faucet
organizational model
business operating model

Do NOT store credentials.

============================================================
64. FINANCIAL_RULES.md
============================================================

Create:

/docs/FINANCIAL_RULES.md

Document:

true COGS methodology
effective-dated COGS
estimated vs actual COGS
refund methodology
prepaid allocation
cash vs profit
contribution profit
cash requirements
Meta headroom
Meta early-payment logic
inventory/cash relationship

============================================================
65. ENTITY_MAP.md
============================================================

Create:

/docs/ENTITY_MAP.md

Document known mappings:

legal entity
brand
store
domain
sales channel
ad account
bank/payment account

Unknown mappings should explicitly say:

TO BE CONFIRMED.

Do not guess.

============================================================
66. PRODUCT_CATALOG.md
============================================================

Create:

/docs/PRODUCT_CATALOG.md

Document known product context.

But explicitly state:

LIVE SHOPIFY DATA IS AUTHORITATIVE FOR ACTIVE PRODUCT CATALOG.

Document known aliases.

Do not use this document as a replacement for live catalog sync.

============================================================
67. INTEGRATIONS.md
============================================================

Create:

/docs/INTEGRATIONS.md

Track:

SHOPIFY
META
CJ
TRIPLE WHALE
GOOGLE
AMAZON
BANKS

For each record:

status
implementation state
credentials required
sync strategy
webhooks/polling
API limitations
last tested
known issues

============================================================
68. DATA_DICTIONARY.md
============================================================

Create:

/docs/DATA_DICTIONARY.md

Define important metrics such as:

Revenue
True Refund
True COGS
Contribution Profit
Available Cash
Cash Required
Meta Headroom
Available Inventory
Sales Velocity
Days of Stock
Projected Stockout
Inbound Inventory

============================================================
69. DECISIONS.md
============================================================

Create:

/docs/DECISIONS.md

Maintain a lightweight decision log.

Example:

DATE
DECISION
REASON
IMPACT

This prevents future agents from reversing important architectural/business
decisions without understanding why.

============================================================
70. INTEGRATION PRIORITY
============================================================

Implementation priority:

PHASE 1

Persistent docs
Database
Authentication
Dashboard
Demo data

PHASE 2

Shopify

PHASE 3

True COGS
Refunds

PHASE 4

Meta spend

PHASE 5

Expenses
Invoices
Recurring payments

PHASE 6

Cash accounts
Cash forecast

PHASE 7

Meta billing
Meta headroom

PHASE 8

CJ
Inventory
SKU mapping

PHASE 9

Supply chain
Inbound inventory
Stockout forecasting

PHASE 10

Scaling simulator combining:

CASH
META
COGS
INVENTORY

PHASE 11

Alerts

PHASE 12

Triple Whale
Google
Amazon
additional integrations

PHASE 13

Company AI

============================================================
71. IMPORTANT: DO NOT OVERBUILD BEFORE FIRST VALUE
============================================================

Although this specification describes the long-term system:

DO NOT attempt to implement every module immediately.

Build vertical slices that actually work.

The first valuable system should answer:

What did we sell?

What was true COGS?

What were true refunds?

What did we spend on ads?

What was contribution profit?

How much cash do we have?

What payments are coming?

How much cash is needed in:

24h
48h
72h
7d

How much Meta headroom remains?

What happens if Meta spend increases?

Then add:

How much inventory do we have?

How many days will it last?

What is inbound?

When will it arrive?

Will we stock out?

What happens to stock if advertising scales?

============================================================
72. CURRENT TASK
============================================================

Now:

1. Read this entire specification.

2. Inspect the current repository and preserve useful existing work.

3. Create:

AGENTS.md

docs/BUSINESS_CONTEXT.md
docs/FINANCIAL_RULES.md
docs/ENTITY_MAP.md
docs/PRODUCT_CATALOG.md
docs/INTEGRATIONS.md
docs/DATA_DICTIONARY.md
docs/DECISIONS.md

4. Design the complete PostgreSQL schema.

5. Create migrations.

6. Build authentication.

7. Build the dashboard shell.

8. Use CLEARLY LABELED demo data until integrations are live.

9. Implement the first version of:

True COGS engine
Cash Requirement engine
Scaling Simulator

10. Prepare integration adapters for:

Shopify
Meta
CJ

11. Prepare inventory schema including:

warehouses
SKU mapping
inventory snapshots
inbound inventory
bundles/BOM
stock velocity
days of stock
projected stockout

12. Create inventory and supply-chain dashboard shells.

13. Do NOT fabricate live integrations.

14. Run the project.

15. Fix build errors.

16. Fix TypeScript errors.

17. Test important calculation logic.

18. Commit the completed foundation to the repository.

============================================================
73. WHEN FINISHED
============================================================

Report exactly:

A. WHAT IS WORKING NOW

B. WHAT IS DEMO / MOCKED

C. WHAT IS NOT YET IMPLEMENTED

D. DATABASE / ARCHITECTURE CREATED

E. CREDENTIALS NEEDED NEXT

F. EXACT STEPS TO CONNECT SHOPIFY

G. EXACT STEPS TO CONNECT META

H. EXACT STEPS TO CONNECT CJ

I. ANY CJ API LIMITATIONS DISCOVERED

J. BUSINESS RULES THAT REQUIRE OWNER CONFIRMATION

K. RECOMMENDED NEXT TASK

Do not ask unnecessary questions before starting.

Start building the foundation.