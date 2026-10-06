# Product catalog and mappings

LIVE SHOPIFY DATA IS AUTHORITATIVE FOR ACTIVE PRODUCT CATALOG.

This document records supplied context, not synchronized inventory or a substitute for live catalog data. No Shopify catalog has been fetched yet. Product prices, exact SKUs/variants, suppliers, BOMs, costs, and stock are TO BE CONFIRMED.

| Brand | Canonical product | Known aliases/context | Supplied activity context |
| --- | --- | --- | --- |
| Godisabove | Bible Verse Jar | Jar; Bible Jar; Scripture Jar; hero devotional/gifting product | Important current product |
| Godisabove | Bible Trivia | Faith/Bible-learning family product | Actively sold per brief |
| Godisabove | Women's Cards | Faith-oriented card product | Actively sold per brief |
| Godisabove | Bible Projector; Verse Discs; other Christian gifting/kids/family products | Historical/additional context | Do not presume active |
| 360 Faucet | TO BE CONFIRMED | Independent brand catalog | Live catalog not supplied |

## Catalog requirements

- Store canonical products, aliases, store-scoped external product/variant IDs and SKUs in the database. New launches must not require code changes.
- Discover new Shopify products/variants; mark missing supplier/cost/inventory mappings UNMAPPED. Unknown cost is never zero cost.
- Mapping chain: Shopify product → variant → Shopify SKU → internal product → supplier → supplier SKU → warehouse inventory.
- Shopify SKU may differ from supplier/CJ SKU. Operations can resolve unmatched SKUs with recorded evidence/history.
- Alias matching and AI extraction can suggest mappings; ambiguous matches require review.
- Support quantities and bundle/BOM components. One customer-facing bundle can consume multiple physical units and packaging components.
- Bundle supplier pricing is not necessarily linear. Physical inventory consumption and economic bundle price are separate rules.
- Inventory is supplier/SKU/warehouse-specific, with available/reserved/processing/inbound/on-hand states only when supported by source data.
- US warehouse visibility is important, but no warehouse identity, stock count, lead time, or location-to-store fulfillment mapping has been supplied.

All numerical pricing, bundle, stock, and velocity examples in the source specifications are illustrative DEMO examples, never confirmed business values.
