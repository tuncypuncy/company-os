import { createHash } from "node:crypto";
import { getDb, appMode } from "./db";
import { integer } from "./finance";
import { stockForecast, bomDemand, earlyPayment } from "./operations-engine";
type Row = Record<string, unknown>;
export type Choice = { id: string; name: string };
export async function operationalWorkspace(
  storeId: string,
  currency: string,
  entityId?: string,
  owner = true,
) {
  const db = await getDb(),
    asOf = new Date().toISOString();
  const scoped = (table: string, extra = "") =>
    db.query<Row>(
      `SELECT * FROM ${table} WHERE store_id=$1 AND currency=$2 AND ($3::text IS NULL OR legal_entity_id=$3) ${extra}`,
      [storeId, currency, entityId ?? null],
    );
  const [
    stores,
    expenses,
    recurring,
    inflows,
    pools,
    orders,
    orderItems,
    costs,
    invoiceItems,
    products,
    variants,
    suppliers,
    supplierSkus,
    warehouses,
    mappings,
    bom,
    stock,
    shipments,
    shipmentItems,
    events,
    settings,
    billing,
    payments,
    credit,
    budgets,
    balances,
    obligations,
    consumption,
    refunds,
    payroll,
    fx,
  ] = await Promise.all([
    db.query<Row>("SELECT * FROM stores WHERE id=$1", [storeId]),
    scoped("expenses", "ORDER BY recognized_date DESC"),
    scoped("recurring_expenses"),
    scoped("expected_inflows"),
    scoped("prepaid_cost_pools"),
    scoped("orders", "ORDER BY ordered_at DESC"),
    db.query<Row>(
      "SELECT i.*,o.external_id FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.store_id=$1 AND o.currency=$2 AND ($3::text IS NULL OR o.legal_entity_id=$3)",
      [storeId, currency, entityId ?? null],
    ),
    db.query<Row>(
      "SELECT c.*,o.external_id,i.product_id FROM order_costs c JOIN order_items i ON i.id=c.order_item_id JOIN orders o ON o.id=i.order_id WHERE o.store_id=$1 AND o.currency=$2 AND ($3::text IS NULL OR o.legal_entity_id=$3) AND c.superseded_at IS NULL",
      [storeId, currency, entityId ?? null],
    ),
    db.query<Row>(
      "SELECT l.*,i.invoice_number FROM invoice_items l JOIN invoices i ON i.id=l.invoice_id WHERE i.store_id=$1 AND i.currency=$2 AND ($3::text IS NULL OR i.legal_entity_id=$3)",
      [storeId, currency, entityId ?? null],
    ),
    db.query<Row>(
      "SELECT p.* FROM products p JOIN stores s ON s.brand_id=p.brand_id WHERE s.id=$1",
      [storeId],
    ),
    db.query<Row>("SELECT * FROM variants WHERE store_id=$1", [storeId]),
    db.query<Row>("SELECT * FROM vendors WHERE kind='SUPPLIER'"),
    db.query<Row>(
      "SELECT sk.* FROM supplier_skus sk JOIN products p ON p.id=sk.product_id JOIN stores s ON s.brand_id=p.brand_id WHERE s.id=$1",
      [storeId],
    ),
    db.query<Row>("SELECT * FROM warehouses"),
    db.query<{ variant_id: string; supplier_sku_id: string }>(
      "SELECT m.* FROM sku_mappings m JOIN variants v ON v.id=m.variant_id WHERE v.store_id=$1",
      [storeId],
    ),
    db.query<{
      bundle_variant_id: string;
      component_variant_id: string;
      quantity: number;
    }>(
      "SELECT c.* FROM bundle_components c JOIN variants v ON v.id=c.bundle_variant_id WHERE v.store_id=$1",
      [storeId],
    ),
    db.query<Row>(
      "SELECT DISTINCT ON(i.supplier_sku_id,i.warehouse_id) i.*,w.name AS warehouse,w.country FROM inventory_snapshots i JOIN warehouses w ON w.id=i.warehouse_id JOIN supplier_skus sk ON sk.id=i.supplier_sku_id JOIN products p ON p.id=sk.product_id JOIN stores s ON s.brand_id=p.brand_id WHERE s.id=$1 ORDER BY i.supplier_sku_id,i.warehouse_id,i.observed_at DESC",
      [storeId],
    ),
    db.query<Row>(
      "SELECT * FROM inbound_shipments WHERE store_id=$1 AND ($2::text IS NULL OR legal_entity_id=$2)",
      [storeId, entityId ?? null],
    ),
    db.query<Row>(
      "SELECT si.* FROM shipment_items si JOIN inbound_shipments s ON s.id=si.shipment_id WHERE s.store_id=$1",
      [storeId],
    ),
    db.query<Row>(
      "SELECT e.* FROM shipment_events e JOIN inbound_shipments s ON s.id=e.shipment_id WHERE s.store_id=$1 ORDER BY occurred_at",
      [storeId],
    ),
    db.query<Row>(
      "SELECT * FROM workspace_settings WHERE store_id=$1 AND currency=$2",
      [storeId, currency],
    ),
    db.query<Row>(
      "SELECT b.* FROM meta_billing_accounts b JOIN ad_accounts a ON a.id=b.ad_account_id WHERE a.store_id=$1 AND b.currency=$2 AND ($3::text IS NULL OR b.legal_entity_id=$3)",
      [storeId, currency, entityId ?? null],
    ),
    db.query<Row>(
      "SELECT p.* FROM meta_payments p JOIN meta_billing_accounts b ON b.id=p.billing_account_id JOIN ad_accounts a ON a.id=b.ad_account_id WHERE a.store_id=$1 AND p.currency=$2 AND ($3::text IS NULL OR b.legal_entity_id=$3)",
      [storeId, currency, entityId ?? null],
    ),
    db.query<Row>(
      "SELECT DISTINCT ON(c.billing_account_id) c.* FROM meta_credit_snapshots c JOIN meta_billing_accounts b ON b.id=c.billing_account_id JOIN ad_accounts a ON a.id=b.ad_account_id WHERE a.store_id=$1 AND b.currency=$2 AND ($3::text IS NULL OR b.legal_entity_id=$3) ORDER BY c.billing_account_id,c.observed_at DESC",
      [storeId, currency, entityId ?? null],
    ),
    db.query<Row>(
      "SELECT DISTINCT ON(b.account_id) b.* FROM ad_budgets b JOIN ad_accounts a ON a.id=b.account_id WHERE a.store_id=$1 AND a.currency=$2 AND a.platform='META' ORDER BY b.account_id,b.effective_at DESC",
      [storeId, currency],
    ),
    db.query<Row>(
      "SELECT DISTINCT ON(b.account_id) b.* FROM cash_balance_snapshots b JOIN cash_accounts a ON a.id=b.account_id WHERE a.store_id=$1 AND a.currency=$2 AND ($3::text IS NULL OR a.legal_entity_id=$3) ORDER BY b.account_id,b.observed_at DESC",
      [storeId, currency, entityId ?? null],
    ),
    db.query<Row>(
      "SELECT o.*,(o.amount_minor-COALESCE((SELECT sum(p.amount_minor) FROM obligation_payments p WHERE p.obligation_id=o.id),0)) AS amount_minor FROM obligations o WHERE store_id=$1 AND currency=$2 AND ($3::text IS NULL OR legal_entity_id=$3)",
      [storeId, currency, entityId ?? null],
    ),
    db.query<Row>(
      "SELECT c.*,p.component FROM prepaid_consumption c JOIN prepaid_cost_pools p ON p.id=c.pool_id WHERE p.store_id=$1 AND p.currency=$2",
      [storeId, currency],
    ),
    db.query<Row>(
      "SELECT r.*,o.external_id FROM refunds r JOIN orders o ON o.id=r.order_id WHERE o.store_id=$1 AND o.currency=$2 AND ($3::text IS NULL OR o.legal_entity_id=$3)",
      [storeId, currency, entityId ?? null],
    ),
    owner ? scoped("payroll_runs") : Promise.resolve({ rows: [] as Row[] }),
    db.query<Row>(
      "SELECT DISTINCT ON(base_currency,quote_currency) * FROM fx_rates ORDER BY base_currency,quote_currency,observed_at DESC",
    ),
  ]);
  const policy = settings.rows[0];
  const freshHours = Number(policy?.freshness_hours ?? 24);
  const stale = (value: unknown) =>
    (Date.parse(asOf) - Date.parse(String(value))) / 3600000 > freshHours;
  const sum = (rows: Row[], field: string) =>
    rows.reduce((total, row) => total + integer(row[field] ?? 0), 0);
  const lookups: Record<string, Choice[]> = {};
  for (const [key, rows, label] of [
    ["products", products.rows, "name"],
    ["recurring", recurring.rows, "vendor"],
    ["inflows", inflows.rows, "title"],
    ["orders", orders.rows, "external_id"],
    ["orderItems", orderItems.rows, "external_id"],
    ["costs", costs.rows, "external_id"],
    ["invoiceItems", invoiceItems.rows, "invoice_number"],
    ["pools", pools.rows, "name"],
    ["suppliers", suppliers.rows, "name"],
    ["supplierSkus", supplierSkus.rows, "sku"],
    ["variants", variants.rows, "sku"],
    ["warehouses", warehouses.rows, "name"],
    ["shipments", shipments.rows, "tracking"],
    ["billing", billing.rows, "name"],
    ["metaPayments", payments.rows, "stage"],
  ] as [string, Row[], string][])
    lookups[key] = rows.map((r) => ({
      id: String(r.id),
      name:
        String(r[label] || r.id) +
        (key === "costs" ? " · " + String(r.estimated_minor) + " minor" : ""),
    }));
  lookups.obligations = obligations.rows
    .filter(
      (o) => o.scope === "COMPANY" && (owner || !sensitiveCategory(o.category)),
    )
    .map((o) => ({ id: String(o.id), name: String(o.title) }));
  const demandFor = (window: number) => {
    const demand: Record<string, number> = {};
    let unmapped = 0;
    for (const item of orderItems.rows) {
      const order = orders.rows.find((o) => o.id === item.order_id);
      if (
        !order ||
        Date.parse(String(order.ordered_at)) <
          Date.parse(asOf) - window * 86400000 ||
        ["CANCELLED", "VOIDED"].includes(String(order.status))
      )
        continue;
      const variant = variants.rows.find((v) => v.sku === item.sku);
      if (!variant) {
        unmapped++;
        continue;
      }
      const hasBom = bom.rows.some((c) => c.bundle_variant_id === variant.id);
      const physical = hasBom
        ? bomDemand(
            String(variant.id),
            Number(item.quantity) / Number(item.bundle_quantity),
            bom.rows,
          )
        : { [String(variant.id)]: Number(item.quantity) };
      for (const [variantId, units] of Object.entries(physical)) {
        const map = mappings.rows.find((m) => m.variant_id === variantId);
        if (!map) {
          unmapped++;
          continue;
        }
        demand[map.supplier_sku_id] =
          (demand[map.supplier_sku_id] || 0) + units / window;
      }
    }
    return { demand, unmapped };
  };
  const windows = Object.fromEntries(
    [1, 3, 7, 14, 30].map((w) => [w, demandFor(w)]),
  );
  const inventory = stock.rows.map((s) => {
    const sku = supplierSkus.rows.find((sk) => sk.id === s.supplier_sku_id);
    const inbound = shipmentItems.rows
      .filter((i) => i.supplier_sku_id === s.supplier_sku_id)
      .flatMap((i) => {
        const ship = shipments.rows.find(
          (sh) =>
            sh.id === i.shipment_id &&
            sh.destination_warehouse_id === s.warehouse_id,
        );
        return ship?.eta
          ? [
              {
                quantity: Number(i.quantity),
                eta: String(ship.eta),
                status: String(ship.status),
              },
            ]
          : [];
      });
    // No country/store routing is inferred. Per-warehouse forecasts disclose total mapped store demand.
    const velocity =
      windows[7].unmapped || !orders.rows.length
        ? null
        : (windows[7].demand[String(s.supplier_sku_id)] ?? 0);
    return {
      ...s,
      id: String(s.id),
      warehouse_id: String(s.warehouse_id),
      country: String(s.country || ""),
      warehouse: String(s.warehouse),
      available: s.available === null ? null : Number(s.available),
      source: String(s.source),
      sku: String(sku?.sku ?? s.supplier_sku_id),
      velocity,
      velocities: Object.fromEntries(
        [1, 3, 7, 14, 30].map((w) => [
          w,
          windows[w].unmapped
            ? null
            : (windows[w].demand[String(s.supplier_sku_id)] ?? 0),
        ]),
      ),
      freshness: stale(s.observed_at) ? "STALE" : "CURRENT",
      ...stockForecast(
        s.available === null ? null : Number(s.available),
        velocity,
        inbound,
        asOf,
        Number(policy?.stock_watch_days ?? 14),
        Number(policy?.stock_critical_days ?? 3),
      ),
    };
  });
  const buffer =
    policy?.safety_buffer_minor == null
      ? null
      : integer(policy.safety_buffer_minor);
  const opening = balances.rows.length
    ? sum(balances.rows, "available_minor")
    : null;
  const outgoing = sum(
    obligations.rows.filter(
      (o) =>
        o.status === "SCHEDULED" &&
        o.scope === "COMPANY" &&
        Date.parse(String(o.due_at)) <= Date.parse(asOf) + 7 * 86400000,
    ),
    "amount_minor",
  );
  const facilities = billing.rows.map((b) => {
    const cr = credit.rows.find((r) => r.billing_account_id === b.id),
      budget = budgets.rows.find((r) => r.account_id === b.ad_account_id);
    const available = cr
        ? integer(cr.limit_minor) - integer(cr.outstanding_minor)
        : null,
      daily = budget ? integer(budget.daily_minor) : null;
    return {
      ...b,
      id: String(b.id),
      clearing_days: b.clearing_days == null ? null : Number(b.clearing_days),
      name: String(b.name),
      limit: cr ? integer(cr.limit_minor) : null,
      debt: cr ? integer(cr.outstanding_minor) : null,
      available,
      daily,
      days:
        available !== null && daily && daily > 0
          ? Math.max(0, available) / daily
          : null,
      source: cr?.source ?? "UNAVAILABLE",
      observedAt: cr?.observed_at ?? null,
      freshness: cr
        ? stale(cr.observed_at)
          ? "STALE"
          : "CURRENT"
        : "UNAVAILABLE",
      recommendation: earlyPayment({
        credit: cr && !stale(cr.observed_at) ? available : null,
        dailySpend: daily,
        clearingDays: b.clearing_days == null ? null : Number(b.clearing_days),
        freeCash: balances.rows.some((r) => stale(r.observed_at))
          ? null
          : opening,
        buffer,
        otherOutflows: outgoing,
      }),
    };
  });
  const alerts: {
    id: string;
    severity: string;
    kind: string;
    reason: string;
    recommendation: string;
    recordId: string;
    at: string;
  }[] = [];
  const add = (
    kind: string,
    severity: string,
    reason: string,
    recordId: string,
    recommendation: string,
  ) =>
    alerts.push({
      id:
        kind +
        ":" +
        recordId +
        ":" +
        createHash("sha256").update(reason).digest("hex").slice(0, 12),
      severity,
      kind,
      reason,
      recordId,
      recommendation,
      at: asOf,
    });
  const connections = (
    await db.query<Row>(
      "SELECT id,platform,status,last_success_at,last_error FROM integration_connections WHERE store_id=$1",
      [storeId],
    )
  ).rows;
  for (const connection of connections) {
    if (connection.status === "ERROR")
      add(
        "INTEGRATION",
        "WATCH",
        String(connection.platform) + " sync requires attention",
        String(connection.id),
        "Review connection permissions and the latest sanitized error",
      );
    else if (
      connection.status === "CONNECTED" &&
      (!connection.last_success_at || stale(connection.last_success_at))
    )
      add(
        "STALE_INTEGRATION",
        "WATCH",
        String(connection.platform) + " source is stale",
        String(connection.id),
        "Run the integration worker and verify the source window",
      );
  }
  for (const pool of pools.rows) {
    const used = consumption.rows
      .filter((c) => c.pool_id === pool.id)
      .reduce((n, c) => n + Number(c.quantity), 0);
    if (used >= Number(pool.eligible_quantity))
      add(
        "PREPAID",
        "WATCH",
        String(pool.name) + " prepaid quantity is exhausted",
        String(pool.id),
        "Review renewed inventory funding and eligible cost assumptions",
      );
  }
  for (const s of inventory) {
    if (s.risk === "WATCH" || s.risk === "CRITICAL")
      add(
        "STOCK",
        s.risk,
        String(s.sku) + " has " + Number(s.days).toFixed(1) + " days of stock",
        String(s.id),
        "Review demand, warehouse routing and inbound availability",
      );
    if (s.stockoutBeforeInbound)
      add(
        "INBOUND",
        "CRITICAL",
        "Projected stockout before inbound availability",
        String(s.id),
        "Expedite confirmed inbound or reduce demand",
      );
    if (s.freshness === "STALE")
      add(
        "STALE_STOCK",
        "WATCH",
        "Inventory snapshot is stale",
        String(s.id),
        "Record or sync a fresh source snapshot",
      );
  }
  for (const f of facilities) {
    if (f.days !== null && f.days < Number(policy?.meta_watch_days ?? 3))
      add(
        "META",
        "CRITICAL",
        String(f.name) + " credit headroom is " + f.days.toFixed(1) + " days",
        String(f.id),
        f.recommendation.reason,
      );
    if (f.freshness === "STALE")
      add(
        "STALE_META",
        "WATCH",
        "Credit snapshot is stale",
        String(f.id),
        "Confirm balance before funding decisions",
      );
  }
  for (const o of obligations.rows.filter(
    (o) =>
      o.status === "SCHEDULED" &&
      o.scope !== "PERSONAL" &&
      (owner || !sensitiveCategory(o.category)),
  )) {
    if (Date.parse(String(o.due_at)) < Date.parse(asOf))
      add(
        "OVERDUE",
        "CRITICAL",
        "Overdue: " + o.title,
        String(o.id),
        "Record settlement or review the due date",
      );
  }
  if (opening !== null && buffer !== null && opening - outgoing < buffer)
    add(
      "CASH",
      "CRITICAL",
      "Opening cash cannot cover seven-day liabilities and buffer",
      storeId,
      "Review dated inflows and funding; balances are not automatically refreshed",
    );
  for (const b of balances.rows)
    if (stale(b.observed_at))
      add(
        "STALE_CASH",
        "WATCH",
        "A cash balance snapshot is stale",
        String(b.id),
        "Record the current available balance",
      );
  if (windows[7].unmapped)
    add(
      "UNMAPPED",
      "WATCH",
      windows[7].unmapped +
        " recent order lines have no complete inventory mapping",
      storeId,
      "Map commercial SKUs and BOM components",
    );
  for (const s of shipments.rows)
    if (
      s.eta &&
      Date.parse(String(s.eta)) < Date.parse(asOf) &&
      !["AVAILABLE", "CANCELLED"].includes(String(s.status))
    )
      add(
        "DELAYED",
        "CRITICAL",
        "Inbound availability date has passed",
        String(s.id),
        "Update the shipment stage and ETA from evidence",
      );
  const acknowledgements = (
    await db.query<{ alert_key: string }>(
      "SELECT alert_key FROM alert_acknowledgements WHERE acknowledged_at>now()-interval '7 days'",
    )
  ).rows;
  const activeAlerts = alerts.filter(
    (a) => !acknowledgements.some((r) => r.alert_key === a.id),
  );
  const visibleExpenses = expenses.rows.filter(
    (e) =>
      owner || (!sensitiveCategory(e.category) && e.recognition !== "PERSONAL"),
  );
  const tables: Record<string, Row[]> = {
    expenses: visibleExpenses,
    recurring: recurring.rows.filter(
      (r) => owner || !sensitiveCategory(r.category),
    ),
    inflows: inflows.rows,
    pools: pools.rows.map((p) => ({
      ...p,
      remaining_value_minor:
        integer(p.total_minor) -
        sum(
          consumption.rows.filter((c) => c.pool_id === p.id),
          "allocated_minor",
        ),
    })),
    orders: orders.rows,
    costs: costs.rows.map((c) => ({
      ...c,
      variance_minor:
        c.actual_minor == null
          ? null
          : integer(c.actual_minor) - integer(c.estimated_minor),
    })),
    refunds: owner ? refunds.rows : [],
    payroll: payroll.rows,
    products: products.rows,
    variants: variants.rows,
    supplierSkus: supplierSkus.rows,
    warehouses: warehouses.rows,
    shipments: shipments.rows,
    shipmentEvents: events.rows,
    facilities: facilities as Row[],
    metaPayments: payments.rows,
    fx: fx.rows,
  };
  if (!owner) {
    lookups.recurring = lookups.recurring.filter((r) =>
      tables.recurring.some((t) => t.id === r.id),
    );
    lookups.metaPayments = [];
  }
  return {
    storeId,
    currency,
    entityId: entityId ?? null,
    mode: appMode(),
    asOf,
    lookups,
    tables,
    inventory,
    facilities,
    alerts: activeAlerts,
    settings: policy ?? null,
    bom: bom.rows,
    mappings: mappings.rows,
    summary: {
      operatingExpenses: sum(
        visibleExpenses.filter((e) => e.recognition === "OPERATING"),
        "amount_minor",
      ),
      prepaidRemaining: sum(tables.pools, "remaining_value_minor"),
      opening,
      buffer,
    },
    mappingCoverage: {
      complete: windows[7].unmapped === 0 && orders.rows.length > 0,
      unmapped: windows[7].unmapped,
    },
    inventoryAssumption:
      "Per-warehouse coverage uses all mapped selected-store demand. Fulfillment routing is not inferred; shared warehouse stock is not reserved by store.",
    source: "MANUAL / PLATFORM / DEMO as recorded",
  };
}
function sensitiveCategory(value: unknown) {
  return /payroll|salary|tax|vat|dividend|distribution|owner|contribution/i.test(
    String(value),
  );
}
export type OperationalWorkspace = Awaited<
  ReturnType<typeof operationalWorkspace>
>;
