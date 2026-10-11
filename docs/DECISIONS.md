# Decision log

Documentation baseline: 2026-10-06. Decisions below distinguish confirmed owner requirements from proposed implementation safeguards. No application implementation is implied.

| ID | Status | Decision | Reason / impact |
| --- | --- | --- | --- |
| D001 | Confirmed | Master Specification V2 supersedes conflicting V1/older prompts | Adds CJ/inventory/supply chain; latest requested file structure is this task's deliverable |
| D002 | Confirmed | Active brands are Godisabove and 360 Faucet | Generic future architecture without unrelated active brands; never 360 FlowSets |
| D003 | Confirmed | Godisabove is an American brand; legal entities remain NL B.V. and Wyoming LLC | Brand market identity does not replace company jurisdiction |
| D004 | Confirmed | Both Godisabove stores sell globally | USA is an operational label; do not map store/entity from customer geography |
| D005 | Confirmed | Unknown account/store/entity mappings stay TO BE CONFIRMED | No guessed domain-to-label or store ownership foreign keys |
| D006 | Confirmed | True supplier economics are effective-dated and bundle-aware | Preserve historical rules, estimates and invoice actuals; platform COGS is comparative |
| D007 | Confirmed | Cash and managerial profit are separate | Prepayments, inventory, settlements and credit billing have different recognition/payment timing |
| D008 | Confirmed | Invoice/SS upload requires date, entity, store selection and human review | Preserve original evidence; distinguish invoice/effective/payment dates and split allocations |
| D009 | Confirmed | Cover all costs, payroll, taxes/VAT, owner taxes/distributions/dividends, and current app subscriptions | Track all obligations while leaving jurisdiction-specific tax treatment unassumed |
| D010 | Implementation safeguard | Deduct each cost/cash event once | Prevent COGS component duplication, Meta accrual/payment duplication, invoice/expense/PO duplicate outflows |
| D011 | Confirmed | No automatic payments or supplier purchase orders | Meta early-payment and reorder outputs are recommendations |
| D012 | Confirmed preference | Next.js/TypeScript/PostgreSQL/Supabase/Tailwind/Recharts; Vercel-compatible | Tool choices are intended, not installed application dependencies |
| D013 | Implementation safeguard | Separate source, verification, freshness, mapping and lifecycle statuses | MANUAL can be confirmed; LIVE can be unreconciled; missing is not zero |
| D014 | Confirmed | Real integrations need verified capabilities with manual/import fallback | No invented Meta/CJ endpoints, fake live feeds, or unsupported inventory states |
| D015 | Scope | This change creates AGENTS.md, README.md and seven docs only | Embedded master-brief application tasks are roadmap context, not implemented or committed by this documentation task |

## UX update — 2026-10-06

D016 — Confirmed owner requirement: Godisabove #FFD602 and Godisabove USA #877AF5; use complementary tones with a sleek, understated visual direction. Applies to operational store themes, not legal entities.

D017 — Proposed design direction: ink surfaces, restrained store accents, tabular financial figures, readable compact tables and accessible interactions. DESIGN_SYSTEM.md and design-preview.html capture this proposal. The concept uses illustrative DEMO figures and is not a working financial application.

## Pending confirmations

These do not block documentation or isolated DEMO development. Resolve each before reporting the affected live value as confirmed.

- Exact Godisabove label ↔ domain ↔ Shopify identity ↔ legal entity and historical effective dates; 360 Faucet store/domain/entity.
- Ad/billing facilities, bank accounts, processors and settlement mappings; shared accounts and cost-allocation policies.
- Reporting currencies, FX sources, rounding policy, reporting timezone and revenue shipping/tax inclusion.
- SKU/supplier mappings, actual bundle prices, rule precedence, effective dates, invoice allocation and landed-cost treatment.
- Internal refund recognition, inventory restocking and COGS/fee recovery methodology.
- Prepaid pool quantities/value/eligibility and consumption rules.
- Meta limits, balances, terms, clearing delays and actual API permissions.
- Current cash, restricted/pending balances, payout schedules, holds, obligations, safety buffers and intercompany cash-transfer treatment.
- Supplier/CJ account capabilities, warehouses, stock-state semantics, BOMs, inbound quantities/ETAs, lead times, MOQ and inventory ownership.
- Actual recurring app/vendor list, prices, renewal dates and refresh sources.
- Employee payroll jurisdictions/schedules and tax remittances; Softdance LLC tax classification; company tax registrations, VAT/sales-tax obligations and filing/payment dates.
- Owner personal tax residency/obligations, company-funded versus personal payments, distribution/dividend classification and any withholding requirements.
- Operations Manager's exact authorization boundaries for payroll, owner records, manual overrides and posting approvals.

## Adding decisions

Record date, status (confirmed/proposed/pending), owner/source, decision, rationale, impact and any superseded ID. A proposal does not become a confirmed business fact through implementation. New confirmed owner rules update both this log and the owning document.

## Working foundation — 2026-10-06

D018 — Authorized: the owner asked to start building. This supersedes D015's documentation-only scope for subsequent implementation.

D019 — Implemented: persistent PGlite for isolated local DEMO, external PostgreSQL pool for live mode; use the company_os schema to avoid touching unrelated public-schema application tables. Demo ignores DATABASE_URL. Live data never uses demo credentials or seed economics.

D020 — Implemented: private server-managed sessions, scrypt password hashes, same-origin write checks, login throttling and explicit Owner/Ops write boundaries. No anonymous live demo entry. MFA/password recovery remain pending.

D021 — Implemented scope: manual invoice review and optional non-overlapping price rules, generic obligations including taxes/payroll/owners, manual balances, basic COGS/cash/headroom and estimated scaling. Reconciliation, revisions, automatic subscriptions, full inventory and integrations remain future slices.

D022 — Implemented safeguard: simplified scaling reports ad accrual separately from cash, and refuses a safe-to-scale verdict when material inputs are missing. Do not market it as exact cash funding.

D023 — Deployment boundary: server-only PostgreSQL access and private file downloads; live uploads require confirmed durable storage. Vercel needs a private object-storage adapter. Current instance validation does not prove external Supabase or deployment readiness.

## 2026-10-06 — Private storage foundation

Use official pinned Supabase SDK for server-side private Storage; keep existing server-managed password/session authentication. Persist attachment provider/bucket in migration 003 so changing defaults preserves historical storage locations. Require verified PostgreSQL TLS regardless of connection-string SSL overrides. External connections remain unverified until securely configured; see LIVE_SETUP.md.

## Autonomous expansion — owner instruction

The owner explicitly authorized completing the credential-independent master backlog, inspecting the real browser, maintaining docs and committing stable progress. Implement manual source flows with the same relational domain models as integrations. Separate economic recognition from canonical cash obligations. Store immutable COGS estimates and reconciliation revisions. Prepaid component allocations replace the original component only while costs are estimates; actual invoice totals remain authoritative. Inventory demand uses physical BOM components, with no inferred country-based fulfillment routing.


## Reporting and operational integrity — 2026-10-06

Group reporting uses currency-separated store totals and preserves per-store cash buffers without implying company transfers. Custom periods are UTC until confirmed store reporting timezones are configured. FX translations require explicit source rates and expose missing coverage. Partial payments preserve outstanding cash liability without changing bank balances.

Integration access remains unverified. Incomplete Meta ad-set budget coverage is not published; CBO/lifetime budgeting needs an independently confirmed total. Imported Shopify fees/refund net basis require review before definitive profit. CJ uses a confirmed official profile only, because current official docs are network-blocked. See INTEGRATION_SETUP.md.

Local OCR/text extraction uses trusted deployment binaries and bounded jobs, requires human confirmation, and never contacts an external extraction provider. Private expense receipts attach to existing expenses without another financial posting. Remaining deployment work includes backups/restore tests, monitoring, retention/orphan reconciliation and account-security extensions.

## Manual production bootstrap — 2026-10-11

The owner confirmed the Ready Vercel deployment origin https://company-os-eight-iota.vercel.app and requested a manual GitHub Actions setup instead of retrying Codex PostgreSQL networking. workflow_dispatch on main uses a separate privileged migration connection and a dedicated company_os_app runtime login. Existing owner credentials and bucket privacy policy are preserved or rejected for review; no demo seed or financial deletion occurs. Logs expose only stages/outcomes, not raw provider errors. See GITHUB_LIVE_SETUP.md. The workflow is implemented but actual GitHub/Supabase execution remains unverified until the owner supplies repository secrets and dispatches it.
