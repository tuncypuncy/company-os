# Company OS agent instructions

Before modifying Company OS, read:

1. [Business context](docs/BUSINESS_CONTEXT.md)
2. [Financial rules](docs/FINANCIAL_RULES.md)
3. [Entity map](docs/ENTITY_MAP.md)
4. [Product catalog](docs/PRODUCT_CATALOG.md)
5. [Integrations](docs/INTEGRATIONS.md)
6. [Data dictionary](docs/DATA_DICTIONARY.md)
7. [Decisions](docs/DECISIONS.md), especially for architectural changes.

For UI work, also read [Design system](docs/DESIGN_SYSTEM.md). Apply the owner-confirmed store colors and accessibility requirements.

## Source of truth

The owner-supplied Master Specification V2 supersedes V1 where they conflict. These documents organize that brief and subsequent owner instructions; they do not establish that software or integrations have been implemented. New explicit owner instructions take precedence. Record confirmed changes in the relevant document and decision log. Flag unresolved conflicts rather than guessing.

Never invent business facts, prices, balances, tax treatment, mappings, lead times, refund rules, or API capabilities. Unknown information must be configurable and marked TO BE CONFIRMED, UNMAPPED, or UNAVAILABLE. Demo fixtures must be isolated and visibly labeled DEMO. Source, verification status, and freshness must accompany financial and inventory data.

## Development rules

- Use the existing isolated checkout; do not create a Git worktree unless the owner requests one.
- Build working vertical slices. The owner has now authorized autonomous execution of the entire credential-independent backlog. Continue through tested vertical slices and commit stable progress; missing external credentials must not stop independent modules.
- Design relational models and migrations before extensive UI. Preferred stack: Next.js, TypeScript, PostgreSQL/Supabase, Tailwind, shadcn/ui where useful, Recharts; Vercel-compatible.
- Consult FINANCIAL_RULES.md before calculations. Preserve historical rule versions, estimates, actuals, source records, and override history. Never silently overwrite financial truth.
- Never infer legal entity or store from customer geography. Both Godisabove stores sell globally.
- Keep catalog, vendor, account, currency, threshold, and mapping configuration database-driven.
- Enforce authentication and authorization server-side, including database/storage access. Initial roles: OWNER and OPERATIONS_MANAGER; preserve a path to FINANCE, ACCOUNTANT, READ_ONLY.
- Keep integration secrets server-side. Validate webhook signatures, isolate tenant/entity access, and make ingestion idempotent. Do not commit secrets or request secret values in chat; document variable names only in a future .env.example.
- AI invoice extraction requires human confirmation before posting. No automatic payments or supplier purchase orders.
- Test meaningful financial edge cases, authorization, duplicate imports/webhooks, historical rules, bundle consumption, currency conversion, and unavailable inputs when implementing those features.
- Report implemented, tested, demo, unavailable, and planned capabilities separately. Update integration state only with evidence.

## Working application

The application has nine migrations, persistent demo PostgreSQL, verified-TLS live architecture, role-based sessions, financial/inventory operations, integration contracts, local extraction and combined scaling decisions. Read README.md for commands and explicit limitations. Integrations and AI extraction are not live. `company_os` is an isolated database schema; never expose it directly to anonymous Supabase/browser clients. Use one process per PGlite data directory.

Current Next.js ships local version-specific guidance in `node_modules/next/dist/docs/`. Consult it when changing framework APIs. `agentRules: false` prevents the dev server from rewriting this file.

Read docs/IMPLEMENTATION_STATUS.md before autonomous backlog work. Current operation definitions, validated transaction service, inventory/cash/Meta engines and integration contracts are implemented; do not replace working flows with placeholder cards. Commit reviewed source changes, not .data, credentials, build caches or temporary TLS fixtures. Native fixture validation is isolated from real books.
