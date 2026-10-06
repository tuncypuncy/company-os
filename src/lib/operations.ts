import { randomUUID } from "node:crypto";
import { z } from "zod";
import { recordPayment } from "./payments";
import { operations } from "./operation-definitions";
import { minor, integer, orderCost, type CostRule } from "./finance";
import {
  nextOccurrence,
  prepaidAllocation,
  bomDemand,
} from "./operations-engine";
import { appMode, type Sql } from "./db";
import { HttpError, type User } from "./auth";
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid calendar date",
  );
const sensitive =
  /payroll|salary|tax|vat|dividend|distribution|owner|contribution/i;
export function parseOperation(raw: unknown, user: Pick<User, "role">) {
  const base = z
    .object({
      action: z.string(),
      storeId: z.string().min(1).max(100),
      entityId: z.string().min(1).max(100),
      currency: z.enum(["USD", "EUR", "GBP"]),
      values: z.record(z.string(), z.string().max(1000)),
    })
    .strict()
    .parse(raw);
  const spec = operations[base.action];
  if (!spec) throw new HttpError(400, "Unknown operation");
  if (spec.owner && user.role !== "OWNER")
    throw new HttpError(403, "Owner permission required");
  const shape: Record<string, z.ZodType> = {};
  for (const f of spec.fields) {
    let field: z.ZodType = z
      .string()
      .trim()
      .min(f.optional ? 0 : 1)
      .max(1000);
    if (f.options) field = z.enum(f.options as [string, ...string[]]);
    else if (f.type === "date") field = isoDate;
    else if (f.type === "datetime-local")
      field = z
        .string()
        .refine((v) => Number.isFinite(Date.parse(v)), "Invalid timestamp");
    else if (f.type === "number")
      field = z
        .string()
        .regex(/^\d+$/)
        .refine(
          (v) => Number.isSafeInteger(Number(v)) && Number(v) <= 1000000000,
          "Invalid quantity",
        );
    if (f.optional) field = field.optional();
    shape[f.name] = field;
  }
  const values = z.object(shape).strict().parse(base.values) as Record<
    string,
    string
  >;
  if (
    user.role !== "OWNER" &&
    (values.recognition === "PERSONAL" || sensitive.test(values.category || ""))
  )
    throw new HttpError(403, "Owner permission required for sensitive records");
  return { ...base, values, actorRole: user.role };
}
export type Command = ReturnType<typeof parseOperation>;
async function one<T = Record<string, unknown>>(
  tx: Sql,
  sql: string,
  args: unknown[],
) {
  const row = (await tx.query<T>(sql, args)).rows[0];
  if (!row)
    throw new HttpError(
      400,
      "Referenced record is missing or belongs to another context",
    );
  return row;
}
export async function executeOperation(tx: Sql, c: Command, actor: string) {
  const v = c.values,
    id = randomUUID(),
    source = appMode() === "demo" ? "DEMO" : "MANUAL";
  const store = await one<{ brand_id: string }>(
    tx,
    "SELECT brand_id FROM stores WHERE id=$1",
    [c.storeId],
  );
  await one(tx, "SELECT id FROM legal_entities WHERE id=$1", [c.entityId]);
  const money = (key: string) => {
    try {
      return minor(v[key]);
    } catch {
      throw new HttpError(400, "Invalid amount: " + key);
    }
  };
  const qty = (key: string, positive = true) => {
    const n = Number(v[key]);
    if (!Number.isSafeInteger(n) || n < (positive ? 1 : 0))
      throw new HttpError(400, "Invalid quantity: " + key);
    return n;
  };
  const product = async (key = "productId") =>
    one(tx, "SELECT id FROM products WHERE id=$1 AND brand_id=$2", [
      v[key],
      store.brand_id,
    ]);
  const obligation = async (
    title: string,
    amount: number,
    due: string,
    category: string,
    scope = "COMPANY",
  ) => {
    if (amount <= 0) return null;
    const oid = randomUUID();
    await tx.query(
      "INSERT INTO obligations(id,legal_entity_id,store_id,title,category,currency,amount_minor,due_at,scope,status,source,verification_status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'SCHEDULED',$10,'CONFIRMED',$11)",
      [
        oid,
        c.entityId,
        c.storeId,
        title,
        category,
        c.currency,
        amount,
        due.length === 10 ? due + "T23:59:59Z" : due,
        scope,
        source,
        actor,
      ],
    );
    return oid;
  };
  if (
    ["stock", "meta-credit"].includes(c.action) &&
    Date.parse(v.observedAt) > Date.now() + 60000
  )
    throw new HttpError(400, "A source observation cannot be in the future");
  switch (c.action) {
    case "payment":
      return {
        id,
        ...(await recordPayment(tx, {
          id: v.obligationId,
          amount: money("amount"),
          paidAt: new Date(v.paidAt).toISOString(),
          reference: v.reference,
          actor,
          owner: true,
          storeId: c.storeId,
          entityId: c.entityId,
          currency: c.currency,
        })),
      };
    case "fees": {
      await one(
        tx,
        "UPDATE orders SET processing_minor=$2,fees_status='CONFIRMED' WHERE id=$1 AND store_id=$3 AND currency=$4 AND legal_entity_id=$5 RETURNING id",
        [v.orderId, money("amount"), c.storeId, c.currency, c.entityId],
      );
      await tx.query(
        "INSERT INTO audit_logs(table_name,record_id,action,next_value,actor_id) VALUES('processing_review',$1,'REVIEW',$2::jsonb,$3)",
        [
          v.orderId,
          JSON.stringify({ reason: v.reason, amount_minor: money("amount") }),
          actor,
        ],
      );
      break;
    }
    case "purchase": {
      const sku = await one<{ supplier_id: string }>(
        tx,
        "SELECT s.* FROM supplier_skus s JOIN products p ON p.id=s.product_id WHERE s.id=$1 AND p.brand_id=$2",
        [v.supplierSkuId, store.brand_id],
      );
      const quantity = qty("quantity"),
        cost = quantity * money("unitCost") + money("freight");
      if (!Number.isSafeInteger(cost) || cost <= 0)
        throw new HttpError(400, "Invalid purchase total");
      const oid = await obligation(
        "Supplier purchase",
        cost,
        v.dueDate,
        "Inventory",
      );
      await tx.query(
        "INSERT INTO purchase_orders(id,supplier_id,legal_entity_id,status,ordered_at,currency,obligation_id) VALUES($1,$2,$3,'CONFIRMED',$4,$5,$6)",
        [
          id,
          sku.supplier_id,
          c.entityId,
          v.orderedDate + "T00:00:00Z",
          c.currency,
          oid,
        ],
      );
      await tx.query(
        "INSERT INTO purchase_order_items(id,purchase_order_id,supplier_sku_id,quantity,cost_minor) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), id, v.supplierSkuId, quantity, cost],
      );
      await tx.query(
        "INSERT INTO purchase_plan(id,store_id,purchase_order_id,lead_days,source,notes) VALUES($1,$2,$3,$4,$5,$6)",
        [randomUUID(), c.storeId, id, qty("leadDays", false), source, v.notes],
      );
      const shipment = randomUUID();
      await tx.query(
        "INSERT INTO inbound_shipments(id,purchase_order_id,destination_warehouse_id,status,eta,source,store_id,legal_entity_id,obligation_id) VALUES($1,$2,$3,'PRODUCTION',$4,$5,$6,$7,$8)",
        [
          shipment,
          id,
          v.warehouseId,
          new Date(v.eta).toISOString(),
          source,
          c.storeId,
          c.entityId,
          oid,
        ],
      );
      await tx.query(
        "INSERT INTO shipment_items(id,shipment_id,supplier_sku_id,quantity) VALUES($1,$2,$3,$4)",
        [randomUUID(), shipment, v.supplierSkuId, quantity],
      );
      await tx.query(
        "INSERT INTO shipment_events(id,shipment_id,status,occurred_at,source) VALUES($1,$2,'PRODUCTION',now(),$3)",
        [randomUUID(), shipment, source],
      );
      break;
    }
    case "order": {
      await product();
      const quantity = qty("quantity"),
        bundle = qty("bundleQuantity");
      if (quantity % bundle)
        throw new HttpError(
          400,
          "Physical quantity must be an exact multiple of the bundle size",
        );
      if (money("discount") > money("gross"))
        throw new HttpError(400, "Discount exceeds gross revenue");
      await tx.query(
        "INSERT INTO orders(id,store_id,legal_entity_id,external_id,ordered_at,currency,gross_minor,discount_minor,processing_minor,source,status,fees_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'CONFIRMED','CONFIRMED')",
        [
          id,
          c.storeId,
          c.entityId,
          v.externalId,
          v.date + "T00:00:00Z",
          c.currency,
          money("gross"),
          money("discount"),
          money("fees"),
          source,
        ],
      );
      await tx.query(
        "INSERT INTO order_items(id,order_id,product_id,sku,quantity,bundle_quantity) VALUES($1,$2,$3,$4,$5,$6)",
        [randomUUID(), id, v.productId, v.sku, quantity, bundle],
      );
      break;
    }
    case "cost-rule": {
      await product();
      if (v.supplierId)
        await one(tx, "SELECT id FROM vendors WHERE id=$1", [v.supplierId]);
      await tx.exec("LOCK TABLE cost_rules IN SHARE ROW EXCLUSIVE MODE");
      const old = (
        await tx.query<{
          id: string;
          version: number;
          effective_start: string;
        }>(
          `SELECT * FROM cost_rules WHERE product_id=$1 AND store_id=$2 AND legal_entity_id=$3 AND currency=$4 AND bundle_quantity=$5 AND sku IS NOT DISTINCT FROM $6 AND country IS NOT DISTINCT FROM $7 AND batch IS NOT DISTINCT FROM $8 AND supplier_id IS NOT DISTINCT FROM $9 AND effective_end IS NULL FOR UPDATE`,
          [
            v.productId,
            c.storeId,
            c.entityId,
            c.currency,
            qty("bundleQuantity"),
            v.sku || null,
            v.country || null,
            v.batch || null,
            v.supplierId || null,
          ],
        )
      ).rows;
      if (old.length > 1)
        throw new HttpError(
          409,
          "Resolve ambiguous historical rules before revision",
        );
      if (
        old[0] &&
        new Date(old[0].effective_start).toISOString().slice(0, 10) >=
          v.effectiveStart
      )
        throw new HttpError(409, "New rule must start after the existing rule");
      if (old[0])
        await tx.query("UPDATE cost_rules SET effective_end=$2 WHERE id=$1", [
          old[0].id,
          v.effectiveStart,
        ]);
      await tx.query(
        `INSERT INTO cost_rules(id,product_id,store_id,legal_entity_id,bundle_quantity,currency,product_minor,packaging_minor,fulfillment_minor,shipping_minor,other_minor,effective_start,version,sku,country,batch,source,supplier_id,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'CONFIRMED')`,
        [
          id,
          v.productId,
          c.storeId,
          c.entityId,
          qty("bundleQuantity"),
          c.currency,
          money("product"),
          money("packaging"),
          money("fulfillment"),
          money("shipping"),
          money("other"),
          v.effectiveStart,
          (old[0]?.version || 0) + 1,
          v.sku || null,
          v.country || null,
          v.batch || null,
          source + ": " + v.reason,
          v.supplierId || null,
        ],
      );
      break;
    }
    case "expense": {
      const amount = money("amount");
      if (amount === 0) throw new HttpError(400, "Expense must be positive");
      const oid = v.linkedObligationId
        ? String(
            (
              await one<{ id: string }>(
                tx,
                "SELECT id FROM obligations WHERE id=$1 AND store_id=$2 AND legal_entity_id=$3 AND currency=$4 AND amount_minor=$5 AND ($6=true OR (scope='COMPANY' AND category !~* 'payroll|salary|tax|vat|dividend|distribution|owner|contribution'))",
                [
                  v.linkedObligationId,
                  c.storeId,
                  c.entityId,
                  c.currency,
                  amount,
                  c.actorRole === "OWNER",
                ],
              )
            ).id,
          )
        : await obligation(
            v.vendor,
            amount,
            v.dueDate,
            v.category,
            v.recognition === "PERSONAL" ? "PERSONAL" : "COMPANY",
          );
      await tx.query(
        "INSERT INTO expenses(id,legal_entity_id,store_id,vendor,category,currency,amount_minor,recognized_date,obligation_id,recognition,source,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
        [
          id,
          c.entityId,
          c.storeId,
          v.vendor,
          v.category,
          c.currency,
          amount,
          v.recognizedDate,
          oid,
          v.recognition,
          source,
          v.notes || "",
          actor,
        ],
      );
      break;
    }
    case "recurring": {
      const amount = money("amount");
      if (!amount) throw new HttpError(400, "Price must be positive");
      await tx.query(
        "INSERT INTO recurring_expenses(id,legal_entity_id,store_id,vendor,category,amount_minor,currency,frequency,next_due,source,last_verified_at,anchor_day) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11)",
        [
          id,
          c.entityId,
          c.storeId,
          v.vendor,
          v.category,
          amount,
          c.currency,
          v.frequency,
          v.nextDue,
          source,
          Number(v.nextDue.slice(8, 10)),
        ],
      );
      break;
    }
    case "recurring-update": {
      const r = await one<{
        category: string;
        amount_minor: string;
        active: boolean;
      }>(
        tx,
        "SELECT * FROM recurring_expenses WHERE id=$1 AND store_id=$2 AND currency=$3 AND legal_entity_id=$4 FOR UPDATE",
        [v.id, c.storeId, c.currency, c.entityId],
      );
      if (sensitive.test(r.category))
        throw new HttpError(
          403,
          "Sensitive subscriptions use owner-only obligations",
        );
      await tx.query(
        "UPDATE recurring_expenses SET price_history=price_history||$2::jsonb,amount_minor=$3,active=$4,last_verified_at=now() WHERE id=$1",
        [
          v.id,
          JSON.stringify([
            {
              amount_minor: r.amount_minor,
              active: r.active,
              changed_at: new Date().toISOString(),
              reason: v.reason,
            },
          ]),
          money("amount"),
          v.active === "ACTIVE",
        ],
      );
      break;
    }
    case "recurring-generate": {
      const rows = (
        await tx.query<{
          id: string;
          vendor: string;
          category: string;
          amount_minor: string;
          next_due: string;
          frequency: string;
          anchor_day: number | null;
        }>(
          "SELECT * FROM recurring_expenses WHERE store_id=$1 AND currency=$2 AND legal_entity_id=$3 AND active=true FOR UPDATE",
          [c.storeId, c.currency, c.entityId],
        )
      ).rows;
      let count = 0;
      for (const r of rows) {
        if (sensitive.test(r.category)) continue;
        let due = new Date(r.next_due).toISOString().slice(0, 10);
        while (due <= v.through) {
          if (++count > 400)
            throw new HttpError(
              400,
              "Generate at most 400 occurrences per request",
            );
          const existing = await tx.query(
            "SELECT id FROM obligations WHERE recurring_expense_id=$1 AND due_at=$2",
            [r.id, due + "T23:59:59Z"],
          );
          if (!existing.rows.length) {
            const oid = await obligation(
              r.vendor,
              integer(r.amount_minor),
              due,
              r.category,
            );
            await tx.query(
              "UPDATE obligations SET recurring_expense_id=$2 WHERE id=$1",
              [oid, r.id],
            );
            await tx.query(
              "INSERT INTO expenses(id,legal_entity_id,store_id,vendor,category,currency,amount_minor,recognized_date,obligation_id,recognition,source,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'OPERATING',$10,$11)",
              [
                randomUUID(),
                c.entityId,
                c.storeId,
                r.vendor,
                r.category,
                c.currency,
                r.amount_minor,
                due,
                oid,
                source,
                actor,
              ],
            );
          }
          due = nextOccurrence(
            due,
            r.frequency,
            r.anchor_day ?? Number(due.slice(8, 10)),
          );
        }
        await tx.query(
          "UPDATE recurring_expenses SET next_due=$2 WHERE id=$1",
          [r.id, due],
        );
      }
      return { id, generated: count };
    }
    case "inflow":
      await tx.query(
        "INSERT INTO expected_inflows(id,legal_entity_id,store_id,title,amount_minor,currency,expected_at,source,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          id,
          c.entityId,
          c.storeId,
          v.title,
          money("amount"),
          c.currency,
          new Date(v.expectedAt).toISOString(),
          source,
          v.status,
        ],
      );
      break;
    case "inflow-update":
      if (money("amount") <= 0)
        throw new HttpError(400, "Expected amount must be positive");
      await one(
        tx,
        "UPDATE expected_inflows SET amount_minor=$2,expected_at=$3,status=$4 WHERE id=$1 AND store_id=$5 AND legal_entity_id=$6 AND currency=$7 AND status IN ('ESTIMATED','CONFIRMED') RETURNING id",
        [
          v.id,
          money("amount"),
          v.expectedAt,
          v.status,
          c.storeId,
          c.entityId,
          c.currency,
        ],
      );
      await tx.query(
        "INSERT INTO audit_logs(table_name,record_id,action,next_value,actor_id) VALUES('inflow_review',$1,'REVIEW',$2::jsonb,$3)",
        [v.id, JSON.stringify({ reason: v.reason }), actor],
      );
      break;
    case "inflow-settle":
      await one(
        tx,
        "UPDATE expected_inflows SET status=$2 WHERE id=$1 AND store_id=$3 AND currency=$4 AND legal_entity_id=$5 AND status IN ('ESTIMATED','CONFIRMED') RETURNING id",
        [v.id, "RECEIVED", c.storeId, c.currency, c.entityId],
      );
      break;
    case "settings": {
      if (qty("critical") > qty("watch"))
        throw new HttpError(
          400,
          "Critical stock threshold must not exceed watch threshold",
        );
      await tx.query(
        "INSERT INTO workspace_settings(store_id,currency,safety_buffer_minor,stock_watch_days,stock_critical_days,meta_watch_days,freshness_hours,refund_policy) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(store_id,currency) DO UPDATE SET safety_buffer_minor=EXCLUDED.safety_buffer_minor,stock_watch_days=EXCLUDED.stock_watch_days,stock_critical_days=EXCLUDED.stock_critical_days,meta_watch_days=EXCLUDED.meta_watch_days,freshness_hours=EXCLUDED.freshness_hours,refund_policy=EXCLUDED.refund_policy",
        [
          c.storeId,
          c.currency,
          money("buffer"),
          qty("watch"),
          qty("critical"),
          qty("metaWatch"),
          qty("freshness"),
          v.refundPolicy,
        ],
      );
      await tx.query(
        "INSERT INTO audit_logs(table_name,record_id,action,next_value,actor_id) VALUES('workspace_settings',$1,'UPDATE',$2::jsonb,$3)",
        [c.storeId + ":" + c.currency, JSON.stringify(v), actor],
      );
      break;
    }
    case "refund": {
      const order = await one<{
        gross_minor: string;
        discount_minor: string;
        internal_refund_minor: string | null;
        platform_refund_minor: string;
      }>(
        tx,
        "SELECT * FROM orders WHERE id=$1 AND store_id=$2 AND currency=$3 AND legal_entity_id=$4 FOR UPDATE",
        [v.orderId, c.storeId, c.currency, c.entityId],
      );
      if (
        money("internal") >
        integer(order.gross_minor) - integer(order.discount_minor)
      )
        throw new HttpError(400, "Refund exceeds order revenue");
      await tx.query(
        "INSERT INTO refunds(id,order_id,external_id,platform_minor,internal_minor,refunded_at,restocked,recovered_cogs_minor,fee_impact_minor,reason,source,override_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$10) ON CONFLICT(order_id,external_id) WHERE external_id IS NOT NULL DO UPDATE SET internal_minor=EXCLUDED.internal_minor,restocked=EXCLUDED.restocked,recovered_cogs_minor=EXCLUDED.recovered_cogs_minor,fee_impact_minor=EXCLUDED.fee_impact_minor,override_reason=EXCLUDED.override_reason",
        [
          id,
          v.orderId,
          v.eventId,
          money("platform"),
          money("internal"),
          v.date + "T00:00:00Z",
          v.restocked === "UNKNOWN" ? null : v.restocked === "YES",
          money("recovered"),
          money("feeImpact"),
          v.reason,
          source,
        ],
      );
      const totals = await one<{ amount: string; platform: string }>(
        tx,
        "SELECT sum(internal_minor) AS amount,sum(platform_minor) AS platform FROM refunds WHERE order_id=$1",
        [v.orderId],
      );
      if (
        integer(totals.amount) >
        integer(order.gross_minor) - integer(order.discount_minor)
      )
        throw new HttpError(400, "Cumulative refunds exceed order revenue");
      const recovery = await one<{ recovered: string; cost: string | null }>(
        tx,
        "SELECT (SELECT coalesce(sum(recovered_cogs_minor),0) FROM refunds WHERE order_id=$1) AS recovered,(SELECT sum(coalesce(oc.actual_minor,oc.estimated_minor)) FROM order_costs oc JOIN order_items oi ON oi.id=oc.order_item_id WHERE oi.order_id=$1 AND oc.superseded_at IS NULL) AS cost",
        [v.orderId],
      );
      if (
        integer(recovery.recovered) > 0 &&
        (recovery.cost == null ||
          integer(recovery.recovered) > integer(recovery.cost))
      )
        throw new HttpError(
          400,
          "Recovered COGS exceeds recorded order costs; calculate costs before reviewing recovery",
        );
      await tx.query(
        "UPDATE orders SET internal_refund_minor=$2, platform_refund_minor=CASE WHEN source IN ('MANUAL','DEMO') THEN $3 ELSE platform_refund_minor END WHERE id=$1",
        [v.orderId, totals.amount, totals.platform],
      );
      break;
    }
    case "cost-calculate": {
      const rules = (
        await tx.query<CostRule>(
          "SELECT * FROM cost_rules WHERE store_id=$1 AND currency=$2 AND legal_entity_id=$3",
          [c.storeId, c.currency, c.entityId],
        )
      ).rows.map((r) => ({
        ...r,
        effective_start: new Date(r.effective_start).toISOString().slice(0, 10),
        effective_end: r.effective_end
          ? new Date(r.effective_end).toISOString().slice(0, 10)
          : null,
      }));
      const items = (
        await tx.query<{
          id: string;
          product_id: string;
          quantity: number;
          bundle_quantity: number;
          ordered_at: string;
          sku: string;
          customer_country: string;
          supplier_id: string;
          supplier_batch: string;
        }>(
          "SELECT i.*,o.ordered_at,o.customer_country,o.supplier_id,o.supplier_batch FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.store_id=$1 AND o.currency=$2 AND o.legal_entity_id=$3",
          [c.storeId, c.currency, c.entityId],
        )
      ).rows;
      let calculated = 0,
        missing = 0;
      for (const item of items) {
        const cost = orderCost(rules, {
          productId: item.product_id,
          storeId: c.storeId,
          entityId: c.entityId,
          currency: c.currency,
          quantity: item.quantity,
          bundleQuantity: item.bundle_quantity,
          date: new Date(item.ordered_at).toISOString().slice(0, 10),
          sku: item.sku,
          country: item.customer_country,
          supplierId: item.supplier_id,
          batch: item.supplier_batch,
        });
        if (cost.total === null) {
          missing++;
          continue;
        }
        const rule = rules.find((r) => r.id === cost.ruleId)!;
        const parts = Object.fromEntries(
          ["product", "packaging", "fulfillment", "shipping", "other"].map(
            (k) => [
              k,
              (integer(rule[(k + "_minor") as keyof CostRule]) *
                item.quantity) /
                item.bundle_quantity,
            ],
          ),
        );
        const result = await tx.query(
          "INSERT INTO order_costs(id,order_item_id,cost_rule_id,rule_version,estimated_minor,components,input_snapshot) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) ON CONFLICT(order_item_id) WHERE superseded_at IS NULL DO NOTHING RETURNING id",
          [
            randomUUID(),
            item.id,
            cost.ruleId,
            cost.version,
            cost.total,
            JSON.stringify(parts),
            JSON.stringify({
              quantity: item.quantity,
              bundleQuantity: item.bundle_quantity,
              productId: item.product_id,
              sku: item.sku,
              orderedAt: item.ordered_at,
              country: item.customer_country,
              supplierId: item.supplier_id,
              batch: item.supplier_batch,
            }),
          ],
        );
        calculated += result.rows.length;
      }
      return { id, calculated, missing };
    }
    case "reconcile": {
      await tx.exec(
        "LOCK TABLE cost_reconciliations IN SHARE ROW EXCLUSIVE MODE",
      );
      const cost = await one<{
        estimated_minor: string;
        order_item_id: string;
      }>(
        tx,
        "SELECT oc.* FROM order_costs oc JOIN order_items oi ON oi.id=oc.order_item_id JOIN orders o ON o.id=oi.order_id WHERE oc.id=$1 AND o.store_id=$2 AND o.currency=$3 AND o.legal_entity_id=$4 FOR UPDATE",
        [v.costId, c.storeId, c.currency, c.entityId],
      );
      const line = await one<{ product_id: string; total: string }>(
        tx,
        "SELECT i.product_id,i.quantity*(i.product_minor+i.packaging_minor+i.fulfillment_minor+i.shipping_minor+i.other_minor) AS total FROM invoice_items i JOIN invoices x ON x.id=i.invoice_id WHERE i.id=$1 AND x.store_id=$2 AND x.currency=$3 AND x.legal_entity_id=$4",
        [v.invoiceItemId, c.storeId, c.currency, c.entityId],
      );
      await one(
        tx,
        "SELECT id FROM order_items WHERE id=$1 AND product_id=$2",
        [cost.order_item_id, line.product_id],
      );
      const allocated = await one<{ amount: string | null }>(
        tx,
        "SELECT sum(actual_minor) AS amount FROM (SELECT DISTINCT ON(order_cost_id) * FROM cost_reconciliations ORDER BY order_cost_id,revision DESC) r WHERE invoice_item_id=$1 AND order_cost_id<>$2",
        [v.invoiceItemId, v.costId],
      );
      if (
        integer(allocated.amount ?? 0) + money("actual") >
        integer(line.total)
      )
        throw new HttpError(
          400,
          "Invoice line allocation exceeds control total",
        );
      await tx.query(
        "INSERT INTO cost_reconciliations(id,order_cost_id,invoice_item_id,actual_minor,estimate_minor,reason,created_by,revision) SELECT $1,$2,$3,$4,$5,$6,$7,COALESCE(max(revision),0)+1 FROM cost_reconciliations WHERE order_cost_id=$2",
        [
          id,
          v.costId,
          v.invoiceItemId,
          money("actual"),
          cost.estimated_minor,
          v.reason,
          actor,
        ],
      );
      await tx.query("UPDATE order_costs SET actual_minor=$2 WHERE id=$1", [
        v.costId,
        money("actual"),
      ]);
      break;
    }
    case "pool": {
      await product();
      const amount = money("amount"),
        quantity = qty("quantity");
      const oid = await obligation(
        v.name,
        amount,
        v.dueDate,
        "Prepaid inventory",
      );
      await tx.query(
        "INSERT INTO prepaid_cost_pools(id,legal_entity_id,store_id,purchased_quantity,remaining_quantity,total_minor,currency,purchased_at,product_id,component,name,obligation_id,source) VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [
          id,
          c.entityId,
          c.storeId,
          quantity,
          amount,
          c.currency,
          v.purchaseDate + "T00:00:00Z",
          v.productId,
          v.component,
          v.name,
          oid,
          source,
        ],
      );
      break;
    }
    case "consume": {
      await tx.exec(
        "LOCK TABLE prepaid_consumption IN SHARE ROW EXCLUSIVE MODE",
      );
      const pool = await one<{
        product_id: string;
        purchased_quantity: number;
        remaining_quantity: number;
        total_minor: string;
      }>(
        tx,
        "SELECT * FROM prepaid_cost_pools WHERE id=$1 AND store_id=$2 AND currency=$3 AND legal_entity_id=$4 FOR UPDATE",
        [v.poolId, c.storeId, c.currency, c.entityId],
      );
      const duplicate = await tx.query(
        "SELECT c.id FROM prepaid_consumption c JOIN prepaid_cost_pools p ON p.id=c.pool_id JOIN prepaid_cost_pools target ON target.id=$2 WHERE c.order_item_id=$1 AND p.component=target.component",
        [v.itemId, v.poolId],
      );
      if (duplicate.rows.length)
        throw new HttpError(
          409,
          "This order component already has a prepaid allocation",
        );
      const item = await one<{ quantity: number }>(
        tx,
        "SELECT i.quantity FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.id=$1 AND i.product_id=$2 AND o.store_id=$3 AND o.currency=$4 AND o.legal_entity_id=$5",
        [v.itemId, pool.product_id, c.storeId, c.currency, c.entityId],
      );
      const quantity = qty("quantity");
      if (quantity !== item.quantity)
        throw new HttpError(
          400,
          "Consume the entire eligible physical order-line quantity to replace its component reliably",
        );
      const allocated = prepaidAllocation(
        integer(pool.total_minor),
        pool.purchased_quantity,
        pool.remaining_quantity,
        quantity,
      );
      await tx.query(
        "INSERT INTO prepaid_consumption(id,pool_id,order_item_id,quantity,allocated_minor) VALUES($1,$2,$3,$4,$5)",
        [id, v.poolId, v.itemId, quantity, allocated],
      );
      await tx.query(
        "UPDATE prepaid_cost_pools SET remaining_quantity=remaining_quantity-$2 WHERE id=$1",
        [v.poolId, quantity],
      );
      break;
    }
    case "payroll": {
      const gross = money("gross"),
        deductions = money("deductions"),
        employer = money("employer");
      if (deductions > gross)
        throw new HttpError(400, "Deductions exceed gross pay");
      const net = await obligation(
        "Net salary: " + v.employee,
        gross - deductions,
        v.payday,
        "Payroll",
      );
      const tax = await obligation(
        "Payroll remittance: " + v.employee,
        deductions + employer,
        v.remittance,
        "Payroll Tax",
      );
      await tx.query(
        "INSERT INTO payroll_runs(id,legal_entity_id,store_id,employee,period,currency,gross_minor,deductions_minor,employer_minor,net_obligation_id,tax_obligation_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [
          id,
          c.entityId,
          c.storeId,
          v.employee,
          v.period,
          c.currency,
          gross,
          deductions,
          employer,
          net,
          tax,
          actor,
        ],
      );
      if (gross + employer > 0)
        await tx.query(
          "INSERT INTO expenses(id,legal_entity_id,store_id,vendor,category,currency,amount_minor,recognized_date,recognition,source,created_by) VALUES($1,$2,$3,$4,'Payroll',$5,$6,$7,'OPERATING',$8,$9)",
          [
            randomUUID(),
            c.entityId,
            c.storeId,
            v.employee,
            c.currency,
            gross + employer,
            v.payday,
            source,
            actor,
          ],
        );
      break;
    }
    case "owner": {
      if (money("withholding") > money("amount"))
        throw new HttpError(400, "Withholding exceeds declared amount");
      const oid = await obligation(
        v.classification + ": " + v.recipient,
        money("amount"),
        v.dueDate,
        v.classification,
        v.scope,
      );
      if (!oid) throw new HttpError(400, "Payment must be positive");
      await tx.query(
        "INSERT INTO owner_records(id,obligation_id,recipient,classification,declared_at,withholding_minor,notes) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          oid,
          v.recipient,
          v.classification,
          v.declaredAt,
          money("withholding"),
          v.notes,
        ],
      );
      break;
    }
    case "product":
      await tx.query(
        "INSERT INTO products(id,brand_id,name,status) VALUES($1,$2,$3,'MANUAL')",
        [id, store.brand_id, v.name],
      );
      if (v.alias)
        await tx.query(
          "INSERT INTO product_aliases(id,product_id,alias) VALUES($1,$2,$3)",
          [randomUUID(), id, v.alias],
        );
      break;
    case "variant":
      await product();
      await tx.query(
        "INSERT INTO variants(id,product_id,store_id,sku,bundle_size) VALUES($1,$2,$3,$4,$5)",
        [id, v.productId, c.storeId, v.sku, qty("bundleSize")],
      );
      break;
    case "supplier":
      await tx.query(
        "INSERT INTO vendors(id,name,kind) VALUES($1,$2,'SUPPLIER')",
        [id, v.name],
      );
      break;
    case "supplier-sku":
      await product();
      await one(tx, "SELECT id FROM vendors WHERE id=$1 AND kind='SUPPLIER'", [
        v.supplierId,
      ]);
      await tx.query(
        "INSERT INTO supplier_skus(id,supplier_id,sku,product_id) VALUES($1,$2,$3,$4)",
        [id, v.supplierId, v.sku, v.productId],
      );
      break;
    case "warehouse":
      await tx.query(
        "INSERT INTO warehouses(id,name,country,supplier_id) VALUES($1,$2,$3,$4)",
        [id, v.name, v.country.toUpperCase(), v.supplierId],
      );
      break;
    case "mapping": {
      const variant = await one<{ product_id: string }>(
        tx,
        "SELECT * FROM variants WHERE id=$1 AND store_id=$2",
        [v.variantId, c.storeId],
      );
      await one(
        tx,
        "SELECT id FROM supplier_skus WHERE id=$1 AND product_id=$2",
        [v.supplierSkuId, variant.product_id],
      );
      await tx.query("DELETE FROM sku_mappings WHERE variant_id=$1", [
        v.variantId,
      ]);
      await tx.query(
        "INSERT INTO sku_mappings(variant_id,supplier_sku_id,status) VALUES($1,$2,'MANUAL')",
        [v.variantId, v.supplierSkuId],
      );
      await tx.query(
        "INSERT INTO audit_logs(table_name,record_id,action,next_value,actor_id) VALUES('sku_mappings',$1,'UPDATE',$2::jsonb,$3)",
        [v.variantId, JSON.stringify(v), actor],
      );
      break;
    }
    case "bom": {
      await tx.exec("LOCK TABLE bundle_components IN SHARE ROW EXCLUSIVE MODE");
      for (const key of ["bundleId", "componentId"])
        await one(tx, "SELECT id FROM variants WHERE id=$1 AND store_id=$2", [
          v[key],
          c.storeId,
        ]);
      await tx.query(
        "INSERT INTO bundle_components(bundle_variant_id,component_variant_id,quantity) VALUES($1,$2,$3) ON CONFLICT(bundle_variant_id,component_variant_id) DO UPDATE SET quantity=EXCLUDED.quantity",
        [v.bundleId, v.componentId, qty("quantity")],
      );
      bomDemand(
        v.bundleId,
        1,
        (
          await tx.query<{
            bundle_variant_id: string;
            component_variant_id: string;
            quantity: number;
          }>("SELECT * FROM bundle_components")
        ).rows,
      );
      break;
    }
    case "stock": {
      await one(
        tx,
        "SELECT s.id FROM supplier_skus s JOIN products p ON p.id=s.product_id WHERE s.id=$1 AND p.brand_id=$2",
        [v.supplierSkuId, store.brand_id],
      );
      await tx.query(
        "INSERT INTO inventory_snapshots(id,supplier_sku_id,warehouse_id,available,reserved,on_hand,observed_at,source,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'CONFIRMED')",
        [
          id,
          v.supplierSkuId,
          v.warehouseId,
          qty("available", false),
          v.reserved ? qty("reserved", false) : null,
          v.onHand ? qty("onHand", false) : null,
          new Date(v.observedAt).toISOString(),
          source,
        ],
      );
      break;
    }
    case "shipment": {
      await one(
        tx,
        "SELECT s.id FROM supplier_skus s JOIN products p ON p.id=s.product_id WHERE s.id=$1 AND p.brand_id=$2",
        [v.supplierSkuId, store.brand_id],
      );
      const oid = await obligation(
        "Inbound supplier / freight",
        money("cost"),
        v.dueDate,
        "Inventory",
      );
      await tx.query(
        "INSERT INTO inbound_shipments(id,destination_warehouse_id,status,eta,carrier,tracking,source,store_id,legal_entity_id,obligation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          id,
          v.warehouseId,
          v.status,
          new Date(v.eta).toISOString(),
          v.carrier || null,
          v.tracking || null,
          source,
          c.storeId,
          c.entityId,
          oid,
        ],
      );
      await tx.query(
        "INSERT INTO shipment_items(id,shipment_id,supplier_sku_id,quantity) VALUES($1,$2,$3,$4)",
        [randomUUID(), id, v.supplierSkuId, qty("quantity")],
      );
      await tx.query(
        "INSERT INTO shipment_events(id,shipment_id,status,occurred_at,source) VALUES($1,$2,$3,now(),$4)",
        [randomUUID(), id, v.status, source],
      );
      break;
    }
    case "shipment-stage": {
      const ship = await one<{
        status: string;
        destination_warehouse_id: string;
      }>(
        tx,
        "SELECT * FROM inbound_shipments WHERE id=$1 AND store_id=$2 AND legal_entity_id=$3 FOR UPDATE",
        [v.id, c.storeId, c.entityId],
      );
      if (["AVAILABLE", "CANCELLED"].includes(ship.status))
        throw new HttpError(409, "Shipment is already closed");
      if (v.status === "AVAILABLE") {
        const lines = (
          await tx.query<{ supplier_sku_id: string; quantity: number }>(
            "SELECT * FROM shipment_items WHERE shipment_id=$1",
            [v.id],
          )
        ).rows;
        for (const line of lines) {
          await tx.exec(
            "LOCK TABLE inventory_snapshots IN SHARE ROW EXCLUSIVE MODE",
          );
          const current = (
            await tx.query<{
              available: number | null;
              reserved: number | null;
              on_hand: number | null;
            }>(
              "SELECT * FROM inventory_snapshots WHERE supplier_sku_id=$1 AND warehouse_id=$2 ORDER BY observed_at DESC LIMIT 1",
              [line.supplier_sku_id, ship.destination_warehouse_id],
            )
          ).rows[0];
          if (!current || current.available === null)
            throw new HttpError(
              400,
              "Record a known stock baseline before receiving inbound",
            );
          await tx.query(
            "INSERT INTO inventory_snapshots(id,supplier_sku_id,warehouse_id,available,reserved,on_hand,observed_at,source,status) VALUES($1,$2,$3,$4,$5,$6,now(),$7,'CONFIRMED')",
            [
              randomUUID(),
              line.supplier_sku_id,
              ship.destination_warehouse_id,
              current.available + line.quantity,
              current.reserved,
              current.on_hand === null ? null : current.on_hand + line.quantity,
              source,
            ],
          );
        }
      }
      await tx.query(
        "UPDATE inbound_shipments SET status=$2,actual_arrival_at=CASE WHEN $2 IN ('WAREHOUSE','AVAILABLE') THEN now() ELSE actual_arrival_at END WHERE id=$1",
        [v.id, v.status],
      );
      await tx.query(
        "INSERT INTO shipment_events(id,shipment_id,status,occurred_at,source) VALUES($1,$2,$3,now(),$4)",
        [id, v.id, v.status, source],
      );
      break;
    }
    case "meta-credit": {
      const aid =
          "manual-meta-" + c.storeId + "-" + c.entityId + "-" + c.currency,
        bid =
          "manual-billing-" + c.storeId + "-" + c.entityId + "-" + c.currency;
      await tx.query(
        "INSERT INTO ad_accounts(id,platform,store_id,legal_entity_id,currency) VALUES($1,'META',$2,$3,$4) ON CONFLICT(id) DO NOTHING",
        [aid, c.storeId, c.entityId, c.currency],
      );
      await tx.query(
        "INSERT INTO meta_billing_accounts(id,ad_account_id,legal_entity_id,name,currency,clearing_days) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,clearing_days=EXCLUDED.clearing_days",
        [bid, aid, c.entityId, v.name, c.currency, qty("clearingDays", false)],
      );
      await tx.query(
        "INSERT INTO meta_credit_snapshots(id,billing_account_id,limit_minor,outstanding_minor,observed_at,source,status) VALUES($1,$2,$3,$4,$5,$6,'CONFIRMED')",
        [
          id,
          bid,
          money("limit"),
          money("debt"),
          new Date(v.observedAt).toISOString(),
          source,
        ],
      );
      await tx.query(
        "INSERT INTO ad_budgets(id,account_id,daily_minor,effective_at,source) VALUES($1,$2,$3,now(),$4)",
        [randomUUID(), aid, money("daily"), source],
      );
      break;
    }
    case "meta-payment": {
      await one(
        tx,
        "SELECT b.id FROM meta_billing_accounts b JOIN ad_accounts a ON a.id=b.ad_account_id WHERE b.id=$1 AND a.store_id=$2 AND b.currency=$3 AND b.legal_entity_id=$4",
        [v.billingId, c.storeId, c.currency, c.entityId],
      );
      const oid = await obligation(
        "Meta facility payment",
        money("amount"),
        v.dueDate,
        "Advertising",
      );
      await tx.query(
        "INSERT INTO meta_payments(id,billing_account_id,obligation_id,amount_minor,currency,stage,expected_clearing_at) VALUES($1,$2,$3,$4,$5,'PLANNED',$6)",
        [
          id,
          v.billingId,
          oid,
          money("amount"),
          c.currency,
          new Date(v.clearingAt).toISOString(),
        ],
      );
      break;
    }
    case "meta-stage": {
      const p = await one<{ stage: string }>(
        tx,
        "SELECT p.* FROM meta_payments p JOIN meta_billing_accounts b ON b.id=p.billing_account_id JOIN ad_accounts a ON a.id=b.ad_account_id WHERE p.id=$1 AND a.store_id=$2 AND p.currency=$3 AND b.legal_entity_id=$4 FOR UPDATE",
        [v.id, c.storeId, c.currency, c.entityId],
      );
      const stages = [
        "PLANNED",
        "INITIATED",
        "SENT",
        "RECEIVED",
        "CREDIT_RESTORED",
      ];
      if (stages.indexOf(v.stage) !== stages.indexOf(p.stage) + 1)
        throw new HttpError(409, "Record payment stages in order");
      await tx.query(
        "UPDATE meta_payments SET stage=$2,actual_clearing_at=CASE WHEN $2='CREDIT_RESTORED' THEN now() ELSE actual_clearing_at END WHERE id=$1",
        [v.id, v.stage],
      );
      break;
    }
    case "ad-spend": {
      const aid =
        "manual-" +
        v.platform.toLowerCase() +
        "-" +
        c.storeId +
        "-" +
        c.entityId +
        "-" +
        c.currency;
      await tx.query(
        "INSERT INTO ad_accounts(id,platform,store_id,legal_entity_id,currency) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",
        [aid, v.platform, c.storeId, c.entityId, c.currency],
      );
      await tx.query(
        "INSERT INTO ad_spend(id,account_id,spend_date,actual_minor,source,status) VALUES($1,$2,$3,$4,$5,'CONFIRMED') ON CONFLICT(account_id,spend_date) DO UPDATE SET actual_minor=EXCLUDED.actual_minor,source=EXCLUDED.source",
        [id, aid, v.date, money("amount"), source],
      );
      break;
    }
    case "entity-map": {
      await tx.exec("LOCK TABLE mapping_history IN SHARE ROW EXCLUSIVE MODE");
      const history = (
        await tx.query<{ effective_start: string }>(
          "SELECT effective_start FROM mapping_history WHERE store_id=$1 AND effective_end IS NULL FOR UPDATE",
          [c.storeId],
        )
      ).rows[0];
      if (
        history &&
        new Date(history.effective_start).toISOString().slice(0, 10) >=
          v.effectiveStart
      )
        throw new HttpError(
          409,
          "Mapping revisions must advance the effective date",
        );
      await tx.query(
        "UPDATE mapping_history SET effective_end=$2 WHERE store_id=$1 AND effective_end IS NULL",
        [c.storeId, v.effectiveStart],
      );
      await tx.query(
        "INSERT INTO mapping_history(id,store_id,legal_entity_id,effective_start,evidence,created_by) VALUES($1,$2,$3,$4,$5,$6)",
        [id, c.storeId, c.entityId, v.effectiveStart, v.evidence, actor],
      );
      await tx.query(
        "UPDATE stores SET legal_entity_id=$2,mapping_status='CONFIRMED' WHERE id=$1",
        [c.storeId, c.entityId],
      );
      break;
    }
    case "fx-rate": {
      if (
        v.base === v.quote ||
        !/^\d+(\.\d{1,10})?$/.test(v.rate) ||
        Number(v.rate) <= 0
      )
        throw new HttpError(400, "Invalid FX pair or rate");
      await tx.query(
        "INSERT INTO fx_rates(id,base_currency,quote_currency,rate,source,observed_at) VALUES($1,$2,$3,$4,$5,$6)",
        [
          id,
          v.base,
          v.quote,
          v.rate,
          v.evidence,
          new Date(v.observedAt).toISOString(),
        ],
      );
      break;
    }
    default:
      throw new HttpError(400, "Unsupported operation");
  }
  return { id };
}
