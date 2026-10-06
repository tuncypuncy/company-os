# Live setup and required information

No external service is connected. Supply credentials only through secure server environment settings, never chat, Git, browser JavaScript or NEXT_PUBLIC variables. Configured metadata is not proof of ingestion. Verify access, sync a small reviewed window, and reconcile representative records before relying on imported results.

## Supabase / PostgreSQL

1. Select the actual Supabase project/region. Obtain its HTTPS project URL, private Storage service-role credential, direct/session PostgreSQL URL and provider-required trusted CA. Transaction pooling is unsuitable for this driver's session search path. Use Node 24 hosting with secure outbound access to the actual project host.
2. Set APP_MODE=live, APP_ORIGIN to the exact public HTTPS origin and DATABASE_URL to a dedicated server login. Optionally supply DATABASE_MIGRATION_URL to the deployment job only. Set DATABASE_CA_FILE if provider trust requires it; never disable certificate verification.
3. Stop the application and run npm ci and npm run db:migrate. Apply all nine migrations. They create company_os and confirmed organization names without demo economics or guessed ownership. Keep company_os outside exposed Supabase Data API schemas.
4. As administrator, review/run db/provision-runtime.sql and grant company_os_runtime to the dedicated application login. Do not give schema ownership, CREATE, SUPERUSER or BYPASSRLS. Re-run grants after migrations; remove migration credentials from the web process.
5. Securely set BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD (14–256 characters), BOOTSTRAP_NAME and BOOTSTRAP_ROLE=OWNER; run npm run user:create; remove bootstrap values. Further accounts can be created in Connections → Workspace access. There is no public signup, email delivery, password recovery or MFA. Deactivation revokes sessions; current-password changes are supported.
6. Create private bucket company-os-invoices, 10 MB object limit, PDF/PNG/JPEG MIME restrictions. Set PRIVATE_STORAGE_PROVIDER=supabase, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET. Never make the bucket public. Downloads require application authentication. A persistent private local volume is an alternative only with DURABLE_STORAGE_CONFIRMED=true.
7. Run npm run live:check, npm test, npm run build and npm start. Verify login and a reviewed test invoice upload/download in authorized staging, then configure backups, restore testing, monitoring and deployment. Readiness checks do not prove commerce connectivity or storage writes.
8. Record each store's ownership/effective date/evidence, currency, refund policy, safety buffer and fresh cash account snapshots. Confirm source timezones and account permissions before historical imports.

Required: project URL/region, secure database URL and CA requirements, private Storage credential, public HTTPS origin, initial owner identity, deployment/backup policy. Supabase Auth is not used; server-managed sessions authenticate against company_os.users.

## Shopify — repeat per store

1. Confirm the exact *.myshopify.com identity, legal entity and effective ownership date. Public storefront domains are insufficient. Create effective-dated ownership mappings before historical ingestion.
2. Create an authorized Shopify app using the currently supported app/custom installation process. Request read_products and read_orders; older orders may require approved read_all_orders. Confirm actual permissions. Obtain the server Admin API token and webhook signing secret. OAuth installation/token refresh is not automated here.
3. Set SHOPIFY_ACCESS_TOKEN and SHOPIFY_WEBHOOK_SECRET, or separate SHOPIFY_* variables per store. Configure shop identity, currently supported quarterly GraphQL version, entity, credential variable names and explicit shipping-revenue policy in Connections. The editable suggested API version is not evidence of external schema verification.
4. Verify access and sync a small window. Review imported product/variant mappings, physical bundle quantities and supplier SKUs. Products remain UNMAPPED until reviewed. Independently confirm processing fees; unavailable fees block definitive profit. Review positive refunds for net-of-tax/shipping basis, restocking and cost recovery.
5. Configure supported Shopify events to APP_ORIGIN/api/webhooks/shopify/<connection-id>, using the exact route shown in Settings. Check the route's allowlisted topic names against the current app interface. Raw-body HMAC, shop identity and event deduplication are enforced; notifications queue an authoritative sync rather than directly posting webhook financial amounts.
6. Schedule npm run integrations:sync in a trusted live server job, for example every ten minutes. Monitor errors and last success. Catalog/order nested pagination and bounded retries are implemented. Payout and processor-fee feeds are not implemented; use reviewed manual inflows/fees.

Required: shop identities, ownership/effective dates, authorized Admin tokens/signing secrets, supported GraphQL version and granted scopes. Official Shopify docs were network-blocked here; fixture contracts are tested, but installed-shop schema compatibility needs live validation.

## Meta

1. Select each actual act_<numeric-id>, currency and legal entity. Create/use an authorized Meta Business app and account-authorized system-user/user token with ads_read; verify current approval requirements in actual App/Business settings. Set META_ACCESS_TOKEN or separate META_* names securely.
2. Configure account ID, currently supported Graph API version, entity and token variable name. Verify access and sync a bounded actual-spend window. Daily actual spend and raw ad-set evidence are retained.
3. Active ad-set daily budgets are published only when every active ad-set has a valid daily budget. Campaign-budget optimization/lifetime budgets are not guessed. Record a reviewed manual total when account budget coverage is incomplete. spend_cap/balance are never assumed to be billing credit.
4. Enter real credit limit/debt evidence, clearing days and payment schedules in Meta billing. Advance payment stages only from confirmation; credit restoration requires a fresh credit snapshot. Fresh balances and an explicit buffer are needed for early-payment recommendations.
5. Schedule integrations:sync and monitor freshness/errors. No automated Meta payment, ad mutation, billing-credit API or Meta webhook is implemented.

Required: account IDs/currency/entity, secure authorized token, read permissions, supported Graph version, and separately confirmed credit/debt/clearing/payment terms. Contract tests and official SDK field checks do not establish actual Meta connectivity.

## CJ

1. Confirm the account, current authorized access token and renewal process against current official documentation; set CJ_ACCESS_TOKEN or separate CJ_* names. API-key token exchange and automatic refresh are not implemented.
2. Create supplier, supplier SKUs, canonical product/BOM mappings and physical warehouses. Confirm external warehouse identities/countries and available versus reserved/on-hand semantics.
3. Configure entity, supplier, credential variable name and a confirmed inventory profile. It must cite a developers.cjdropshipping.com documentation URL and the documented /api2.0/v1/ inventory path, SKU parameter, rows path, availability field and warehouse field with confirmed=true. This advanced contract needs verified official evidence.
4. Confirm the profile against a real redacted response before syncing. A missing profile fails DOCUMENTATION_REQUIRED. Manual supplier inventory, US warehouse filtering, inbound tracking and purchase planning work independently.
5. Schedule bounded sync after validation and renew tokens securely. Shipment/ETA tracking stays manual until official logistics endpoints are independently implemented. No purchase is submitted automatically.

Required: authorized token, account/supplier identity, accessible current official inventory/auth documentation, redacted response schema, SKU/warehouse mappings and stock semantics. Official CJ documentation is network-blocked. CJ logistics, token refresh and supplier invoice APIs remain unimplemented; no guessed endpoint is called.

## Scheduled operations and local extraction

Schedule npm run operations:tick daily to generate active reviewed recurring contracts through seven days ahead, idempotently. It creates expenses/liabilities and never pays them. Prevent overlapping job invocations operationally. Integration sync is separate.

Local extraction uses Tesseract for PNG/JPG and pdftotext for text PDFs without external credentials. Install these binaries in the deployment worker; optionally configure TESSERACT_BINARY/PDFTOTEXT_BINARY/PDFTOPPM_BINARY. Hosts without binaries show manual fallback. Scanned PDFs use bounded pdftoppm rasterization before OCR. Extraction is limited to two concurrent jobs per process, twenty seconds and five PDF pages. Human review remains mandatory.

## Business evidence still needed

Store/domain/entity ownership and dates; real currency accounts/FX sources; nonlinear supplier bundle pricing and effective dates; supplier cash timing and whether invoice actuals include prepaid components; fulfillment routing, lead times and MOQ; safety/freshness thresholds; refund net basis and recovery policy; Meta credit/clearing terms; payroll/owner/dividend treatment, owner residency, LLC tax classification and jurisdiction-specific tax rates/deadlines. The application tracks reviewed amounts/dates and does not invent tax advice.
