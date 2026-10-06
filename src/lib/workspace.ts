import { getDb, appMode } from "./db";
import {
  integer,
  orderCost,
  profitability,
  cashForecast,
  metaHeadroom,
  type CostRule,
  type CashEvent,
} from "./finance";
export async function workspace(
  storeId: string,
  currency: string,
  days: number,
  entityId?: string,
  includePrivate = true,
) {
  const db = await getDb();
  const asOf = new Date().toISOString();
  const today = asOf.slice(0, 10);
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const [
    stores,
    entities,
    products,
    orders,
    items,
    rules,
    ads,
    balances,
    obligations,
    inflows,
    invoices,
    recurring,
    connections,
    credit,
    budgets,
  ] = await Promise.all([
    db.query<{
      id: string;
      name: string;
      accent_color: string;
      brand_id: string;
      mapping_status: string;
    }>(
      "SELECT id,name,accent_color,brand_id,mapping_status FROM stores ORDER BY id",
    ),
    db.query<{ id: string; name: string }>(
      "SELECT id,name FROM legal_entities ORDER BY name",
    ),
    db.query<{ id: string; name: string; brand_id: string }>(
      "SELECT id,name,brand_id FROM products ORDER BY name",
    ),
    db.query<{
      id: string;
      ordered_at: string;
      legal_entity_id: string;
      gross_minor: string;
      discount_minor: string;
      internal_refund_minor: string | null;
      platform_refund_minor: string;
      processing_minor: string;
      currency: string;
      source: string;
    }>(
      "SELECT * FROM orders WHERE store_id=$1 AND currency=$2 AND ordered_at>=$3 AND ordered_at<=$4 AND ($5::text IS NULL OR legal_entity_id=$5) ORDER BY ordered_at",
      [storeId, currency, start.toISOString(), asOf, entityId ?? null],
    ),
    db.query<{
      id: string;
      order_id: string;
      product_id: string;
      quantity: number;
      bundle_quantity: number;
    }>(
      "SELECT i.* FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.store_id=$1 AND o.currency=$2 AND o.ordered_at>=$3 AND o.ordered_at<=$4 AND ($5::text IS NULL OR o.legal_entity_id=$5)",
      [storeId, currency, start.toISOString(), asOf, entityId ?? null],
    ),
    db.query<CostRule>(
      "SELECT * FROM cost_rules WHERE store_id=$1 AND currency=$2 AND ($3::text IS NULL OR legal_entity_id=$3)",
      [storeId, currency, entityId ?? null],
    ),
    db.query<{ actual_minor: string; spend_date: string; platform: string }>(
      "SELECT s.actual_minor,s.spend_date,a.platform FROM ad_spend s JOIN ad_accounts a ON a.id=s.account_id WHERE a.store_id=$1 AND a.currency=$2 AND s.spend_date>=$3 AND s.spend_date<=$4 AND ($5::text IS NULL OR a.legal_entity_id=$5)",
      [
        storeId,
        currency,
        start.toISOString().slice(0, 10),
        today,
        entityId ?? null,
      ],
    ),
    db.query<{
      name: string;
      legal_entity_id: string;
      available_minor: string;
      observed_at: string;
      source: string;
    }>(
      "SELECT a.name,a.legal_entity_id,b.available_minor,b.observed_at,b.source FROM cash_accounts a JOIN LATERAL (SELECT * FROM cash_balance_snapshots WHERE account_id=a.id ORDER BY observed_at DESC LIMIT 1) b ON true WHERE a.store_id=$1 AND a.currency=$2 AND ($3::text IS NULL OR a.legal_entity_id=$3)",
      [storeId, currency, entityId ?? null],
    ),
    db.query<{
      id: string;
      title: string;
      category: string;
      amount_minor: string;
      currency: string;
      legal_entity_id: string;
      store_id: string;
      due_at: string;
      status: string;
      scope: string;
      source: string;
      filing_date: string | null;
      period: string | null;
    }>(
      "SELECT id,title,category,amount_minor,currency,legal_entity_id,store_id,due_at,status,scope,source,filing_date,period FROM obligations WHERE store_id=$1 AND currency=$2 AND ($3::text IS NULL OR legal_entity_id=$3) ORDER BY due_at",
      [storeId, currency, entityId ?? null],
    ),
    db.query<{
      id: string;
      amount_minor: string;
      currency: string;
      legal_entity_id: string;
      expected_at: string;
      status: string;
    }>(
      "SELECT * FROM expected_inflows WHERE store_id=$1 AND currency=$2 AND ($3::text IS NULL OR legal_entity_id=$3)",
      [storeId, currency, entityId ?? null],
    ),
    db.query<{
      id: string;
      vendor: string;
      invoice_number: string;
      invoice_date: string;
      effective_date: string;
      due_date: string;
      total_minor: string;
      currency: string;
      status: string;
      source: string;
      legal_entity_id: string;
      attachment_id: string | null;
    }>(
      "SELECT i.id,i.vendor,i.invoice_number,i.invoice_date,i.effective_date,i.due_date,i.total_minor,i.currency,i.status,i.source,i.legal_entity_id,a.id as attachment_id FROM invoices i LEFT JOIN invoice_attachments a ON a.invoice_id=i.id WHERE i.store_id=$1 AND i.currency=$2 AND ($3::text IS NULL OR i.legal_entity_id=$3) ORDER BY i.created_at DESC",
      [storeId, currency, entityId ?? null],
    ),
    db.query<{
      id: string;
      vendor: string;
      amount_minor: string;
      currency: string;
      frequency: string;
      next_due: string;
      source: string;
    }>(
      "SELECT * FROM recurring_expenses WHERE store_id=$1 AND currency=$2 AND ($3::text IS NULL OR legal_entity_id=$3)",
      [storeId, currency, entityId ?? null],
    ),
    db.query<{ id: string; platform: string; status: string }>(
      "SELECT id,platform,status FROM integration_connections ORDER BY platform",
    ),
    db.query<{
      limit_minor: string;
      outstanding_minor: string;
      observed_at: string;
      source: string;
    }>(
      "SELECT c.* FROM meta_credit_snapshots c JOIN meta_billing_accounts b ON b.id=c.billing_account_id JOIN ad_accounts a ON a.id=b.ad_account_id WHERE a.store_id=$1 AND a.currency=$2 AND ($3::text IS NULL OR b.legal_entity_id=$3) ORDER BY c.observed_at DESC LIMIT 1",
      [storeId, currency, entityId ?? null],
    ),
    db.query<{ daily_minor: string }>(
      "SELECT b.daily_minor FROM ad_budgets b JOIN ad_accounts a ON a.id=b.account_id WHERE a.store_id=$1 AND a.platform=$2 AND a.currency=$3 AND ($4::text IS NULL OR a.legal_entity_id=$4) ORDER BY b.effective_at DESC LIMIT 1",
      [storeId, "META", currency, entityId ?? null],
    ),
  ]);
  const typedRules = rules.rows.map((r) => ({
    ...r,
    effective_start: new Date(r.effective_start).toISOString().slice(0, 10),
    effective_end: r.effective_end
      ? new Date(r.effective_end).toISOString().slice(0, 10)
      : null,
    product_minor: integer(r.product_minor),
    packaging_minor: integer(r.packaging_minor),
    fulfillment_minor: integer(r.fulfillment_minor),
    shipping_minor: integer(r.shipping_minor),
    other_minor: integer(r.other_minor),
  }));
  const costs = items.rows.map((item) => {
    const order = orders.rows.find((o) => o.id === item.order_id)!;
    return {
      ...item,
      ...orderCost(typedRules, {
        productId: item.product_id,
        storeId,
        entityId: order.legal_entity_id,
        quantity: item.quantity,
        bundleQuantity: item.bundle_quantity,
        date: new Date(order.ordered_at).toISOString().slice(0, 10),
        currency,
      }),
    };
  });
  const total = (values: unknown[]) =>
    values.reduce<number>((a, v) => a + integer(v), 0);
  const missing = costs.filter((c) => c.total === null).length;
  const missingRefunds = orders.rows.filter(
    (o) => o.internal_refund_minor === null,
  ).length;
  const metrics = profitability({
    gross: total(orders.rows.map((o) => o.gross_minor)),
    discounts: total(orders.rows.map((o) => o.discount_minor)),
    refunds: total(
      orders.rows.map(
        (o) => o.internal_refund_minor ?? o.platform_refund_minor,
      ),
    ),
    fees: total(orders.rows.map((o) => o.processing_minor)),
    ads: total(ads.rows.map((a) => a.actual_minor)),
    cogs: missing ? null : total(costs.map((c) => c.total)),
  });
  const opening = balances.rows.length
    ? total(balances.rows.map((b) => b.available_minor))
    : null;
  const outflows: CashEvent[] = obligations.rows.map((o) => ({
    id: o.id,
    amount: integer(o.amount_minor),
    currency: o.currency,
    entityId: o.legal_entity_id,
    dueAt: o.due_at,
    status: o.status,
    scope: o.scope,
  }));
  const incoming: CashEvent[] = inflows.rows.map((o) => ({
    id: o.id,
    amount: integer(o.amount_minor),
    currency: o.currency,
    entityId: o.legal_entity_id,
    dueAt: o.expected_at,
    status: o.status,
  }));
  const forecasts = [24, 48, 72, 168].map((hours) =>
    opening === null
      ? {
          hours,
          outgoing: null,
          incoming: null,
          ending: null,
          buffer: null,
          surplus: null,
          fundingNeeded: null,
        }
      : cashForecast({
          opening,
          buffer: appMode() === "demo" ? 8000000 : 0,
          currency,
          asOf,
          hours,
          outflows,
          inflows: incoming,
          entityId,
        }),
  );
  const chart = Array.from({ length: days }, (_, i) => {
    const day = new Date(start.getTime() + i * 86400000)
      .toISOString()
      .slice(0, 10);
    const daily = orders.rows.filter(
      (o) => new Date(o.ordered_at).toISOString().slice(0, 10) === day,
    );
    const dailyCosts = costs.filter((c) =>
      daily.some((o) => o.id === c.order_id),
    );
    return {
      date: day,
      revenue:
        total(
          daily.map(
            (o) =>
              integer(o.gross_minor) -
              integer(o.discount_minor) -
              integer(o.internal_refund_minor ?? o.platform_refund_minor),
          ),
        ) / 100,
      cogs: dailyCosts.some((c) => c.total === null)
        ? null
        : total(dailyCosts.map((c) => c.total)) / 100,
      ads:
        total(
          ads.rows
            .filter(
              (a) => new Date(a.spend_date).toISOString().slice(0, 10) === day,
            )
            .map((a) => a.actual_minor),
        ) / 100,
    };
  });
  const dailySpend = budgets.rows[0]
    ? integer(budgets.rows[0].daily_minor)
    : null;
  const creditRow = credit.rows[0];
  return {
    mode: appMode(),
    asOf,
    timezone: "UTC",
    currency,
    storeId,
    entityId: entityId ?? null,
    days,
    stores: stores.rows,
    entities: entities.rows,
    products: products.rows,
    metrics: {
      ...metrics,
      net: orders.rows.length ? metrics.net : null,
      profit: orders.rows.length ? metrics.profit : null,
      margin: orders.rows.length ? metrics.margin : null,
      cogs: missing || !costs.length ? null : total(costs.map((c) => c.total)),
      ads: ads.rows.length ? total(ads.rows.map((a) => a.actual_minor)) : null,
      refunds: total(
        orders.rows.map(
          (o) => o.internal_refund_minor ?? o.platform_refund_minor,
        ),
      ),
      fees: total(orders.rows.map((o) => o.processing_minor)),
      orders: orders.rows.length,
      missingCosts: missing,
      missingRefunds,
    },
    chart: orders.rows.length ? chart : [],
    costs,
    costRules: typedRules,
    cash: {
      opening,
      balances: balances.rows,
      forecasts,
      bufferConfigured: appMode() === "demo",
    },
    obligations: obligations.rows.filter(
      (o) =>
        includePrivate ||
        (o.scope !== "PERSONAL" &&
          ![
            "Payroll",
            "Employer Contributions",
            "VAT",
            "Sales Tax",
            "Corporate Tax",
            "Payroll Tax",
            "Owner Tax",
            "Owner Salary",
            "Owner Draw",
            "Distribution",
            "Dividend",
          ].includes(o.category)),
    ),
    invoices: invoices.rows,
    recurring: recurring.rows,
    connections: connections.rows,
    meta:
      creditRow && dailySpend !== null
        ? {
            ...metaHeadroom(
              integer(creditRow.limit_minor),
              integer(creditRow.outstanding_minor),
              dailySpend,
            ),
            dailySpend,
            limit: integer(creditRow.limit_minor),
            debt: integer(creditRow.outstanding_minor),
            observedAt: creditRow.observed_at,
            source: creditRow.source,
          }
        : null,
    inventory: {
      status: "UNAVAILABLE",
      reason:
        "CJ is not connected. Stock counts, warehouse mappings and inbound ETAs have not been supplied.",
    },
    assumptions: [
      "Reporting dates use UTC. Revenue excludes tax; demo gross includes shipping.",
      "Internal refunds use explicitly labeled demo adjustments. Live methodology needs confirmation.",
      "The selected store is not an entity mapping. Demo attribution is fictional.",
      "Credit-billed Meta spend is not added again to cash outflows; scheduled invoices are used.",
    ],
  };
}
export type Workspace = Awaited<ReturnType<typeof workspace>>;
