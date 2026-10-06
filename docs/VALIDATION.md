# Validation — 2026-10-06

## Verified

- 27 financial, database, operation, provider-contract, private-storage, TLS, FX, extraction-proposal and reorder tests: passed, zero skipped. Operation cases cover recurring month-end/idempotence/cancellation, immutable cost snapshots, supplier-specific historical rules, refund review/recovery bounds, reconciliation revisions/control totals, prepaid exhaustion, exactly-once stock receipt, payroll privacy, imported-order deduplication, partial payment control totals and group/date reporting.
- TypeScript and optimized Next.js production build passed.
- Real native PostgreSQL 17 with trusted local test TLS passed all nine repeatable migrations, real driver dates, live-mode demo isolation, transaction rollback and actor audits. Runtime permission-group SQL executed; runtime audit deletion and migration writes were denied.
- Production-server Chromium baseline test passed: unauthenticated/cross-origin rejection, both brand themes, reviewed invoice upload/persistence/download, owner tax/payment/balance records, password login/failure, Ops permission/privacy boundaries, inventory/scenario pages and mobile navigation/no page overflow.
- Extended production-server browser test passed: subscription entry/generation, lineage, physical stock/inbound receipt/duplicate rejection/US filtering, partial payment and outstanding balance, FX, saved combined scenarios, missing-credential connection errors, audits, group/brand reports and mobile layout.
- Actual local PNG OCR, text PDF extraction and scanned-PDF rasterization/OCR passed with browser-generated fictional documents. Proposals remained UNREVIEWED. Expense receipt upload/private download/content deduplication passed.
- Production dependency audit reported zero vulnerabilities at the check time. This is a point-in-time result.
- Live-mode local HTTP webhook fixture passed raw-body HMAC/shop/topic rejection, durable duplicate prevention and disabled demo entry. It did not contact Shopify.
- Private Supabase SDK behavior is fixture-tested, including private-bucket validation, immutable object locations and cleanup.

All mutation tests used isolated fictional records. Native PostgreSQL was a local Docker fixture, not the user's Supabase project. Browser screenshots contain DEMO data, not live books.

## Unverified / remaining

Actual Supabase project/storage, installed Shopify GraphQL schema and scopes, Meta account access, CJ current official endpoint/profile and token lifecycle, real signed webhook delivery, live financial reconciliation, production hosting/backups/restore/monitoring, environment draft publication and restoration. Tax treatment/deadline computation, MFA/password recovery, provider payouts/fees and bank feeds are not implemented.

## Browser evidence

The screenshots under screenshots/ are real rendered fictional demo workflows. Godisabove uses yellow and Godisabove USA lavender; mobile layouts were checked at 390 pixels. Latest extended screenshots are also produced by scripts/operations-smoke.mjs under SMOKE_ARTIFACTS_DIR. Commands and safety boundaries are in README.md. Exact live steps are in INTEGRATION_SETUP.md.
