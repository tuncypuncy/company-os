# Entity and account map

Known business entities are not proof of ownership mappings. TO BE CONFIRMED is a deliberate unresolved value; it must not become a guessed foreign key.

## Legal entities

| Legal name | Jurisdiction/type | Currency context | Unconfirmed |
| --- | --- | --- | --- |
| Omurtak B.V. | Netherlands; Dutch B.V. | EUR important; multi-currency | Reporting currency, tax registrations, banks/processors |
| Softdance LLC | Wyoming, US; LLC | USD important; US banking | Tax classification, registrations, banks/processors |

The owner's residence is outside the Netherlands; exact tax residency is TO BE CONFIRMED. It does not change company jurisdiction.

## Commercial mappings

| Brand | Operational store | Domain | Legal entity | Sales channel/account |
| --- | --- | --- | --- | --- |
| Godisabove | GODISABOVE | Exact domain-to-label mapping TO BE CONFIRMED | TO BE CONFIRMED | Shopify identity TO BE CONFIRMED |
| Godisabove | GODISABOVE USA | Exact domain-to-label mapping TO BE CONFIRMED | TO BE CONFIRMED | Shopify identity TO BE CONFIRMED |
| 360 Faucet | TO BE CONFIRMED | TO BE CONFIRMED | TO BE CONFIRMED | TO BE CONFIRMED |

Godisabove-associated domains supplied: godisabove.com and godisabove-us.com. Their resemblance to store labels is not a confirmed mapping. Both Godisabove stores sell globally; USA is not a geographic restriction.

## Independent account mappings

| Object | Required mapping | Current state |
| --- | --- | --- |
| Meta/Google ad account | Account ID, billing entity, attributed brand/store, currency | TO BE CONFIRMED |
| Meta billing account | Linked ad accounts, entity, credit facility, currency | TO BE CONFIRMED |
| Bank/cash account | Entity, currency, account identity | TO BE CONFIRMED |
| Processor/Shopify payouts | Store/channel, merchant entity, settlement destination | TO BE CONFIRMED |
| Amazon account | Seller/channel, entity, brand/product attribution | TO BE CONFIRMED |
| CJ/supplier account | Supplier identity, SKU mappings, warehouses | TO BE CONFIRMED |
| Warehouse | Supplier/operator, location, stock ownership | TO BE CONFIRMED |
| Tax/payroll account | Responsible entity/person, jurisdiction, registration | TO BE CONFIRMED |

Mappings should carry effective dates, evidence/source, review status, and audit history. Ambiguous historical attribution must be surfaced for review. Customer geography is an analytics dimension, not attribution logic. Consolidated cash is not automatically transferable between entities; any intercompany funding needs explicit records and treatment.
