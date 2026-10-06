# Business context

## Authority and implementation state

Based on the owner-supplied Master Business Context V1, Master Specification V2, and subsequent chat requirements. V2 supersedes conflicting older briefs. Statements below are business context or requirements, not evidence of implementation. Current delivery: working local V0.1 with isolated DEMO data, manual invoice/obligation/balance flows and calculation engines. See README.md for implemented capabilities and limitations.

## Confirmed organization

- Omurtak B.V.: Netherlands, Dutch B.V.; established international e-commerce operator. EUR is important, but transactions are multi-currency. Statutory/reporting currency remains configurable.
- Softdance LLC: Wyoming, United States, US LLC; separate legal entity with US banking infrastructure. USD is important. Tax classification is not supplied.
- The group has the same owner. The owner lives outside the Netherlands; precise residence/tax residency is not supplied. Residence is separate from entity jurisdiction.
- Godisabove is an American, Christian/faith-based consumer brand and the primary established high-volume DTC business. Most customers are in the US, with Canada, Australia, UK, and other countries also served.
- Store labels GODISABOVE and GODISABOVE USA are operational identifiers. Both sell globally with broadly similar geographic mixes. Known associated domains: godisabove.com and godisabove-us.com. Exact store/account/entity mappings require confirmation.
- 360 Faucet is a separate active brand with independent economics. Do not rename it 360 FlowSets.
- Only Godisabove and 360 Faucet are active implementation scope. Additional brands must be configurable later.

## Organizational model

Support legal entities, brands, stores, sales channels, orders, products/variants, suppliers, warehouses, ad accounts, bank accounts, payment processors, vendors, expenses, invoices, inventory, and shipments. Avoid rigid one-to-one relationships. Customer country never determines store or legal entity. Confirmed account/store/channel mappings determine attribution.

## Mission and coverage

Company OS joins commerce, true supplier economics, refunds, advertising, accounts payable, cash, Meta billing, inventory, supply chain, forecasting, and scaling decisions. It is a managerial operating system; it is not automatically statutory accounting software. Triple Whale remains useful for attribution/comparison but is not authoritative for internal COGS, refunds, or profit.

The owner also requires all costs: taxes/VAT where applicable, payroll and employer costs, owner tax dates and distributions/dividends, freelancers, agencies, applications/SaaS, inventory, freight, fulfillment, and other recurring or one-off obligations. Tax treatment is entity-specific and never inferred from American brand identity. Personal owner obligations must be distinguishable from company obligations.

Supplier COGS input must support invoice/screenshot upload with date, legal entity, and store selection, reviewed line-item extraction, product/SKU mapping, and confirmed reconciliation. Invoice date, cost effective date, and payment date are distinct.

## Product surfaces

- Main dashboard: revenue, ads, true COGS/refunds, contribution profit/margin, available cash, 24h/48h/72h/7d cash needs, Meta utilization/headroom, upcoming payments, inventory risk and inbound inventory.
- Charts: revenue, contribution profit, COGS, ads, cash, margin, refunds, inventory coverage.
- Filters: Today, Yesterday, 7D, 30D, MTD, custom; group/entity/brand/store/currency. Reporting timezone must be configured.
- Invoice center, expenses/subscriptions, obligations calendar, Meta billing, cash accounts, inventory, supply-chain timeline, unmapped SKUs, scaling simulator, and in-app alerts.
- Desktop-first responsive design inspired by modern fintech; no brand cloning.
- OWNER has complete visibility/control. OPERATIONS_MANAGER uploads/reviews invoices, maintains expenses/suppliers, records payments, maps SKUs, and manages inbound inventory. Future FINANCE, ACCOUNTANT, READ_ONLY roles.
- Future Company AI queries authorized structured data and provides provenance; it must not invent financial or stock answers.

## Delivery sequence from V2

1. Persistent docs, database, authentication, dashboard, DEMO data.
2. Shopify.
3. True COGS and refunds.
4. Meta spend.
5. Expenses, invoices, recurring payments, including comprehensive obligation tracking.
6. Cash accounts and cash forecast.
7. Meta billing/headroom.
8. CJ, inventory, SKU mapping.
9. Supply chain, inbound inventory, stockout forecasting.
10. Scaling simulator combining cash, Meta, COGS, and inventory.
11. Alerts.
12. Triple Whale, Google, Amazon, banks and additional integrations.
13. Company AI.

Core COGS/cash/simulator engines may be developed with clearly labeled manual/demo inputs before credentials exist. First value is reliable commerce/profit/cash/Meta visibility; inventory expands it afterward. Finish each implemented slice with useful tests, integrity checks, documented state, and precise missing credentials/rules.

## Confirmed UX identity

Godisabove uses #FFD602 (yellow); Godisabove USA uses #877AF5 (lavender), with complementary tones. The owner wants a distinctive, sleek, understated interface with ambitious polish relative to Triple Whale. Use restrained accents, clear financial typography, and explicit store identity. See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) and the DEMO-only visual concept. Store theme does not establish legal entity mappings.
